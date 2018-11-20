#! /usr/bin/env node
'use strict';
var WebpackageReleasePreparer = require('../lib/cubx-prepare-webpackage-release');
var commandLineArgs = require('command-line-args');

var webpackagePath;

var optionDefinitions = [
  { name: 'webpackagePath', type: String, defaultOption: true, alias: 'p' },
  { name: 'releaseVersion', type: String, alias: 'r' },
  { name: 'nextVersion', type: String, alias: 'n' }
];

var options = commandLineArgs(optionDefinitions);
var versions = {};

if (!options.webpackagePath) {
  console.error('Missed necessary parameter "webpackagePath". Usage: cubx-prepare-webpackage-release -p <webpackagPath>');
  process.exit(0);
} else {
  webpackagePath = options.webpackagePath;
}

if (options.releaseVersion) {
  versions.releaseVersion = options.releaseVersion;
}
if (options.nextVersion) {
  versions.nextVersion = options.nextVersion;
}
var preparer = new WebpackageReleasePreparer(webpackagePath, versions);
preparer.prepareUpload();
