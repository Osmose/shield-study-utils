/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {utils: Cu} = Components;
Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource://gre/modules/ClientID.jsm");
Cu.import("resource://gre/modules/TelemetryEnvironment.jsm");
Cu.import("resource://gre/modules/TelemetryController.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.importGlobalProperties(["crypto", "TextEncoder"]);

this.EXPORTED_SYMBOLS = ["Shield"];

const ADDON_DISABLE = 4;
const ADDON_UNINSTALL = 6;

let studyName = null;
let addonId = null;

function _requireStudyName() {
  if (studyName === null) {
    throw new Error("Cannot use Shield utils until Shield.bootstrap has been called");
  }
}

this.Shield = {
  async startup(studyConfig, data) {
    const requiredOptions = ["name", "branches"];
    for (const option of requiredOptions) {
      if (!(option in studyConfig)) {
        throw new Error(`startup was not given required config ${option}`);
      }
    }

    studyName = studyConfig.name;
    addonId = data.id;

    const branchPref = `shield.${studyName}.branch`;
    let branch = null;
    if (Preferences.has(branchPref)) {
      branch = Preferences.get(branchPref);
    } else {
      branch = await Shield.chooseBranch(studyConfig.branches);
      Preferences.set(branchPref, branch);

      // If they didn't have a branch, this is the first run of the study.
      Shield.reportEvent("studyStart");
    }

    TelemetryEnvironment.setExperimentActive(studyName, branch);
    Shield.reportEvent("running");
  },

  async shutdown(data, reason) {
    const branchPref = `shield.${studyName}.branch`;
    TelemetryEnvironment.setExperimentInactive(studyName, Preferences.get(branchPref));

    if (reason === ADDON_DISABLE) {
      await Shield.endStudy('disabled');
    } else if (reason === ADDON_UNINSTALL) {
      await Shield.endStudy('uninstalled', false);
    }
  },

  async chooseBranch(branches) {
    const cid = await ClientID.getClientID();
    const branchIndex = await Sampling.ratioSample(cid, branches.map(b => b.weight));
    return branches[branchIndex].name;
  },

  reportEvent(type, data) {
    const payload = {type, data};
    const options = {addClientId: true, addEnvironment: true};
    TelemetryController.submitExternalPing("shield", payload, options);
  },

  async endStudy(reason, uninstall=true) {
    if (uninstall) {
      const addon = await AddonManager.getAddonByID(addonId);
      addon.uninstall();
    }
    Shield.reportEvent("studyEnd", {reason});
  },

  getBranch() {
    _requireStudyName();
    return Preferences.get(`shield.${studyName}.branch`);
  },
};


/**
 * Sampling functions adapted from the Normandy recipe client.
 */
const Sampling = {
  hashBits: 48,
  get hashLength() {
    // each hexadecimal digit represents 4 bits
    return Sampling.hashBits / 4;
  },
  get hashMultiplier() {
    Math.pow(2, Sampling.hashBits) - 1;
  },

  /**
   * Map from the range [0, 1] to [0, 2^48].
   * @param  {number} frac A float from 0.0 to 1.0.
   * @return {string} A 48 bit number represented in hex, padded to 12 characters.
   */
  fractionToKey(frac) {
    if (frac < 0 || frac > 1) {
      throw new Error(`frac must be between 0 and 1 inclusive (got ${frac})`);
    }

    return Math.floor(frac * Sampling.hashMultiplier)
      .toString(16)
      .padStart(Sampling.hashLength, "0");
  },

  /**
   * @param {ArrayBuffer} buffer Data to convert
   * @returns {String}    `buffer`'s content, converted to a hexadecimal string.
   */
  bufferToHex(buffer) {
    const hexCodes = [];
    const view = new DataView(buffer);
    for (let i = 0; i < view.byteLength; i += 4) {
      // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
      const value = view.getUint32(i);
      // toString(16) will give the hex representation of the number without padding
      hexCodes.push(value.toString(16).padStart(8, "0"));
    }

    // Join all the hex strings into one
    return hexCodes.join("");
  },

  /**
   * @promise A hash of `data`, truncated to the 12 most significant characters.
   */
  async truncatedHash(data) {
    const hasher = crypto.subtle;
    const input = new TextEncoder("utf-8").encode(JSON.stringify(data));
    const hash = await hasher.digest("SHA-256", input);
    // truncate hash to 12 characters (2^48), because the full hash is larger
    // than JS can meaningfully represent as a number.
    return Sampling.bufferToHex(hash).slice(0, 12);
  },

  /**
   * Sample over a list of ratios such that, over the input space, each ratio
   * has a number of matches in correct proportion to the other ratios.
   *
   * For example, given the ratios:
   *
   * [1, 2, 3, 4]
   *
   * 10% of all inputs will return 0, 20% of all inputs will return 1, 30% will
   * return 2, and 40% will return 3. You can determine the percent of inputs
   * that will return an index by dividing the ratio by the sum of all ratios
   * passed in. In the case above, 4 / (1 + 2 + 3 + 4) == 0.4, or 40% of the
   * inputs.
   *
   * @param {object} input
   * @param {Array<integer>} ratios
   * @promises {integer}
   *   Index of the ratio that matched the input
   * @rejects {Error}
   *   If the list of ratios doesn't have at least one element
   */
  async ratioSample(input, ratios) {
    if (ratios.length < 1) {
      throw new Error(`ratios must be at least 1 element long (got length: ${ratios.length})`);
    }

    const inputHash = await Sampling.truncatedHash(input);
    const ratioTotal = ratios.reduce((acc, ratio) => acc + ratio);

    let samplePoint = 0;
    for (let k = 0; k < ratios.length - 1; k++) {
      samplePoint += ratios[k];
      if (inputHash <= Sampling.fractionToKey(samplePoint / ratioTotal)) {
        return k;
      }
    }

    // No need to check the last bucket if the others didn't match.
    return ratios.length - 1;
  },
};
