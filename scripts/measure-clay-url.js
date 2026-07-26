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

// Estimated budgets for the Clay data: URI — not verified on device WebViews.
var DEFAULT_WARN = 200000;
var DEFAULT_MAX = 400000;

function parseSizeArgs() {
  var warn = DEFAULT_WARN;
  var max = DEFAULT_MAX;
  process.argv.slice(2).forEach(function (arg) {
    var warnMatch = arg.match(/^--warn(?:=(\d+))?$/);
    if (warnMatch) {
      warn = warnMatch[1] ? parseInt(warnMatch[1], 10) : warn;
      return;
    }
    var maxMatch = arg.match(/^--max(?:=(\d+))?$/);
    if (maxMatch) {
      max = maxMatch[1] ? parseInt(maxMatch[1], 10) : max;
    }
  });
  return { warn: warn, max: max };
}

var Clay = require('@rebble/clay/dist/js/index.js');
var clayConfig = require('../src/pkjs/config');
var customClay = require('../src/pkjs/custom-clay');

var userData = {
  version: '1.2.0',
  githubUrl: 'https://github.com/filcuk/pebble-watchface-argus',
};

var clayBase = new Clay(clayConfig, function () {}, {
  autoHandleEvents: false,
  userData: userData,
});

clayBase.meta = {
  activeWatchInfo: { platform: 'emery' },
  accountToken: '',
  watchToken: '',
  userData: userData,
};

var baseUrlLength = clayBase.generateUrl().length;
var configJsonBytes = JSON.stringify(clayConfig).length;

console.log('config json bytes:', configJsonBytes);
console.log('base clay url length (no customFn):', baseUrlLength);

var clay = new Clay(clayConfig, customClay, {
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
  console.log('total url length:', url.length);
  console.log('customFn contribution:', url.length - baseUrlLength);

  var limits = parseSizeArgs();
  console.log('warn threshold:', limits.warn, '(estimated, not tested)');
  console.log('max allowed:', limits.max, '(estimated, not tested)');
  if (url.length > limits.max) {
    console.error('Clay URL exceeds limit by', url.length - limits.max, 'bytes');
    process.exit(1);
  }
  if (url.length > limits.warn) {
    console.warn(
      'Clay URL exceeds warning threshold by',
      url.length - limits.warn,
      'bytes (estimated budget; not tested on device)'
    );
  }
} catch (err) {
  console.error('generateUrl failed:', err && err.stack ? err.stack : err);
  process.exit(1);
}
