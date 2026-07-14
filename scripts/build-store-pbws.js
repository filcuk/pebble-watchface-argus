#!/usr/bin/env node
/**
 * Build two .pbw files for dual-store publishing (short-term).
 *
 *   rePebble / Core  — canonical UUID (package.json default)
 *   Rebble community — legacy listing UUID
 *
 * Usage (from repo root, with pebble on PATH — typically WSL):
 *   node scripts/build-store-pbws.js
 *   npm run build:store
 *
 * Outputs:
 *   build/store/argus-<version>-repebble.pbw
 *   build/store/argus-<version>-rebble.pbw
 *
 * Restores package.json uuid to the canonical value afterward.
 */

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');

var ROOT = path.join(__dirname, '..');
var PKG_PATH = path.join(ROOT, 'package.json');
var PBW_SRC = path.join(ROOT, 'build', 'pebble-watchface-argus.pbw');
var OUT_DIR = path.join(ROOT, 'build', 'store');

var CANONICAL_UUID = '7b435c75-5965-4f3f-8c1c-206acf20ca7f';
var REBBLE_LEGACY_UUID = 'f8c3a2b1-4d5e-6f70-8a9b-0c1d2e3f4a5b';

function readPkg() {
  return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
}

function writePkg(pkg) {
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function setUuid(uuid) {
  var pkg = readPkg();
  pkg.pebble.uuid = uuid;
  writePkg(pkg);
}

function buildPbw(label, uuid, outPath) {
  console.log('\n=== ' + label + ' (' + uuid + ') ===');
  setUuid(uuid);
  execSync('pebble build', { cwd: ROOT, stdio: 'inherit' });
  if (!fs.existsSync(PBW_SRC)) {
    throw new Error('Expected PBW missing: ' + PBW_SRC);
  }
  fs.copyFileSync(PBW_SRC, outPath);
  console.log('Wrote ' + path.relative(ROOT, outPath));
}

function main() {
  var pkg = readPkg();
  var version = pkg.version || '0.0.0';
  var previousUuid = pkg.pebble && pkg.pebble.uuid;

  if (previousUuid && previousUuid !== CANONICAL_UUID) {
    console.warn(
      'Warning: package.json uuid was ' + previousUuid +
        '; canonical is ' + CANONICAL_UUID + '. Will restore to canonical.'
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  var outRepebble = path.join(OUT_DIR, 'argus-' + version + '-repebble.pbw');
  var outRebbler = path.join(OUT_DIR, 'argus-' + version + '-rebble.pbw');

  try {
    buildPbw('rePebble / Core', CANONICAL_UUID, outRepebble);
    buildPbw('Rebble community (legacy listing)', REBBLE_LEGACY_UUID, outRebbler);
  } finally {
    setUuid(CANONICAL_UUID);
    console.log('\nRestored package.json uuid to ' + CANONICAL_UUID);
  }

  console.log('\nStore builds ready:');
  console.log('  ' + path.relative(ROOT, outRepebble));
  console.log('  ' + path.relative(ROOT, outRebbler));
}

main();
