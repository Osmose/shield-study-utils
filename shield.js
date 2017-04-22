#!/usr/bin/env node
var program = require('commander');

program
  .version('0.1.0')
  .command('run', 'Run study in Firefox')
  .command('test', 'Run tests')
  .parse(process.argv);
