#!/usr/bin/env node
var program = require('commander');
var getFirefox = require("get-firefox");
var execSync = require('child_process').execSync;
var path = require('path');
var fs = require('fs');
var FirefoxProfile = require('firefox-profile');
var runFirefox = require('fx-runner');

var addonDir = null;
program
  .version('0.1.0')
  .arguments('<addonDir>')
  .option('-b, --binary [path]', 'Path to Firefox binary')
  .action(function(cmdAddonDir) {
    addonDir = path.resolve(cmdAddonDir);
  })
  .parse(process.argv);

var profile = new FirefoxProfile();
profile.addExtension(addonDir, () => {
  profile.setPreference('xpinstall.signatures.required', false);
  profile.setPreference('extensions.logging.enabled', false);
  profile.updatePreferences();
  runFirefox({
    binary: program.binary,
    profile: profile.path(),
    'no-remote': true,
    foreground: true,
  }).then(function(results) {
    var firefox = results.process;
    firefox.on('error', function(err) {
      console.error(err);
    });
  });
});
