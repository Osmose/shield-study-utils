/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {utils: Cu} = Components;
Cu.import("resource://gre/modules/Log.jsm");

const log = Log.repository.getLogger();
log.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
log.level = 0;

const STUDY_CONFIG = {
  name: "shield-study-example",
  branches: [
    {name: "control", weight: 1},
    {name: "dogs", weight: 1},
    {name: "cats", weight: 2},
  ],
};

this.install = function() {
  log.error("Install!");
};

this.startup = function(data, reason) {
  Cu.import("resource://shield-study-example/lib/Shield.jsm");
  Shield.startup(STUDY_CONFIG, data, reason);
  log.error("Startup!");
};

this.shutdown = async function(data, reason) {
  log.error("Shutdown!");
  await Shield.shutdown(data, reason);
  Cu.unload("resource://shield-study-example/lib/Shield.jsm");
};

this.uninstall = function() {
  log.error("Uninstall!");
};
