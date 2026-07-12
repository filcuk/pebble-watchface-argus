#!/usr/bin/env node
'use strict';

global.Pebble = {
  platform: 'pypkjs',
  getActiveWatchInfo: function () {
    return { platform: 'emery' };
  },
  getAccountToken: function () {
    return '';
  },
  getWatchToken: function () {
    return '';
  },
  addEventListener: function () {},
};

global.localStorage = {
  getItem: function () {
    return null;
  },
  setItem: function () {},
};

var Module = require('module');
var mockMessageKeysPath = require('path').join(__dirname, 'mock-message-keys.js');
var originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request === 'message_keys') {
    return mockMessageKeysPath;
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

var Clay = require('@rebble/clay/dist/js/index.js');
var clayConfig = require('../src/pkjs/config');
var customClay = require('../src/pkjs/custom-clay');

console.log('config json bytes:', JSON.stringify(clayConfig).length);

var userData = {
  version: '1.2.0',
  githubUrl: 'https://github.com/filcuk/pebble-watchface-argus',
};

var clay = new Clay(clayConfig, function () {}, {
  autoHandleEvents: false,
  userData: userData,
});

clay.meta = {
  activeWatchInfo: { platform: 'emery' },
  accountToken: '',
  watchToken: '',
  userData: userData,
};

console.log('empty customFn url length:', clay.generateUrl().length);

clay = new Clay(clayConfig, customClay, {
  autoHandleEvents: false,
  userData: userData,
});

clay.meta = {
  activeWatchInfo: { platform: 'emery' },
  accountToken: '',
  watchToken: '',
  userData: userData,
};

try {
  var started = Date.now();
  var url = clay.generateUrl();
  console.log('generateUrl ms:', Date.now() - started);
  console.log('url length:', url.length);
} catch (err) {
  console.error('generateUrl failed:', err && err.stack ? err.stack : err);
  process.exit(1);
}
