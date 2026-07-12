#!/usr/bin/env node
'use strict';

var Module = require('module');
var mockMessageKeysPath = require('path').join(__dirname, 'mock-message-keys.js');
var messageKeysPath = require('path').join(__dirname, 'message_keys.js');
var originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request === 'message_keys') {
    return messageKeysPath;
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

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
  sendAppMessage: function (payload, ok) {
    if (ok) {
      ok();
    }
  },
  addEventListener: function (event, handler) {
    if (event === 'ready') {
      setTimeout(handler, 0);
    }
    if (event === 'showConfiguration') {
      global.__showConfiguration = handler;
    }
  },
  openURL: function (url) {
    console.log('openURL length:', url.length);
  },
};

global.localStorage = {
  getItem: function () {
    return null;
  },
  setItem: function () {},
};

try {
  require('../build/pebble-js-app.js');
} catch (err) {
  console.error('bundle load failed:', err && err.stack ? err.stack : err);
  process.exit(1);
}

setTimeout(function () {
  if (global.__showConfiguration) {
    try {
      global.__showConfiguration();
      console.log('showConfiguration ok');
    } catch (err) {
      console.error('showConfiguration failed:', err && err.stack ? err.stack : err);
      process.exit(1);
    }
  } else {
    console.error('showConfiguration handler missing');
    process.exit(1);
  }
}, 50);
