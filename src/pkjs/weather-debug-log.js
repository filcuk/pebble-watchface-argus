'use strict';

var LOG_KEY = 'argus-weather-debug-log';
var LOG_MAX = 85;
var logCache = null;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTime(ts) {
  var d = new Date(ts);
  var h = ('0' + d.getHours()).slice(-2);
  var m = ('0' + d.getMinutes()).slice(-2);
  var s = ('0' + d.getSeconds()).slice(-2);
  return h + ':' + m + ':' + s;
}

function entryClass(tag) {
  if (!tag) {
    return '';
  }
  if (tag.indexOf('!') !== -1) {
    return 'argus-wlog-err';
  }
  if (tag === 'C+' || tag === 'GEO+' || tag === 'NIGHT') {
    return 'argus-wlog-cache';
  }
  if (tag === 'C-' || tag === 'SKIP' || tag === 'STALE' || tag === 'RETRY') {
    return 'argus-wlog-warn';
  }
  return 'argus-wlog-ok';
}

function formatPanelHtml(entries) {
  if (!entries || !entries.length) {
    return (
      '<div class="argus-weather-log-empty">No events yet. Use the watchface, then close and reopen settings to refresh this log.</div>'
    );
  }

  var lines = [];
  var i;
  for (i = entries.length - 1; i >= 0; i -= 1) {
    var entry = entries[i];
    var cls = entryClass(entry.tag);
    var msg = entry.msg ? ' ' + escapeHtml(entry.msg) : '';
    lines.push(
      '<div class="argus-wlog-line ' +
        cls +
        '"><span class="argus-wlog-t">' +
        formatTime(entry.t) +
        '</span> <span class="argus-wlog-tag">' +
        escapeHtml(entry.tag) +
        '</span>' +
        msg +
        '</div>'
    );
  }

  var legend =
    '<div class="argus-wlog-legend">REQ watch request · SND phone send · SKIP skip<br>' +
    'C cache · API Open-Meteo · RETRY phone backoff · GPS fix<br>' + 
    'reopen settings to refresh</div>';

  return legend + '<div class="argus-weather-log">' + lines.join('') + '</div>';
}

function readLog() {
  if (logCache) {
    return logCache;
  }
  try {
    var raw = localStorage.getItem(LOG_KEY);
    if (raw) {
      logCache = JSON.parse(raw);
      if (Array.isArray(logCache)) {
        return logCache;
      }
    }
  } catch (e) {
    // Ignore parse errors.
  }
  logCache = [];
  return logCache;
}

function writeLog(entries) {
  logCache = entries;
  var json = JSON.stringify(entries);
  try {
    localStorage.setItem(LOG_KEY, json);
  } catch (e) {
    // Ignore storage errors.
  }
}

function appendLog(tag, msg) {
  var entries = readLog().slice();
  entries.push({
    t: Date.now(),
    tag: tag,
    msg: msg || '',
  });
  if (entries.length > LOG_MAX) {
    entries = entries.slice(entries.length - LOG_MAX);
  }
  writeLog(entries);
}

function formatAgeMs(ms) {
  if (!isFinite(ms)) {
    return '?';
  }
  if (ms < 0) {
    ms = 0;
  }
  if (ms < 60000) {
    return Math.round(ms / 1000) + 's';
  }
  return Math.round(ms / 60000) + 'm';
}

function formatAgeMinutes(ms) {
  if (ms < 0) {
    ms = 0;
  }
  return Math.round(ms / 60000) + 'm';
}

module.exports = {
  LOG_KEY: LOG_KEY,
  LOG_MAX: LOG_MAX,
  append: appendLog,
  read: readLog,
  formatAgeMs: formatAgeMs,
  formatAgeMinutes: formatAgeMinutes,
  formatPanelHtml: formatPanelHtml,
};
