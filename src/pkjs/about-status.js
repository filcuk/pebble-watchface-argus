var holidays = require('./holidays');
var weatherDebugLog = require('./weather-debug-log');

var LAST_GPS_FIX_KEY = 'argus-last-gps-fix';
var WEATHER_FETCH_CACHE_KEY = 'weather-fetch-cache';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readJson(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function formatClock(ms) {
  if (!ms) {
    return '—';
  }
  var d = new Date(ms);
  if (isNaN(d.getTime())) {
    return '—';
  }
  var day = d.getDate();
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var hh = d.getHours();
  var mm = d.getMinutes();
  var hhStr = hh < 10 ? '0' + hh : String(hh);
  var mmStr = mm < 10 ? '0' + mm : String(mm);
  return day + ' ' + months[d.getMonth()] + ' ' + hhStr + ':' + mmStr;
}

function formatHolidayDate(entry) {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return entry.day + ' ' + months[entry.month];
}

function cacheApiFetchedAt(cache) {
  if (!cache) {
    return 0;
  }
  return cache.apiFetchedAt || cache.fetchedAt || 0;
}

function regionDisplayName(countryCode, regionCode) {
  if (!regionCode) {
    return '';
  }
  var list = holidays.getSubdivisionsForCountry(countryCode) || [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    if (list[i].code === regionCode) {
      return list[i].name || regionCode;
    }
  }
  return regionCode;
}

function locationPending(cache, gps) {
  if (!cache || gps == null || gps.lat == null || gps.lon == null) {
    return false;
  }
  if (cache.latQ == null || cache.lonQ == null) {
    return false;
  }
  return Number(cache.latQ) !== Number(gps.lat) || Number(cache.lonQ) !== Number(gps.lon);
}

function weatherSectionHtml(options) {
  var cache = readJson(WEATHER_FETCH_CACHE_KEY);
  var gps = readJson(LAST_GPS_FIX_KEY);
  var apiMs = cacheApiFetchedAt(cache);
  var intervalMs = options.intervalMs || 60 * 60 * 1000;
  var lines = [];
  var warnClass = '';

  lines.push('<div class="argus-setting-label">Weather</div>');

  if (!apiMs) {
    lines.push('<p class="argus-about-line">No weather fetch yet.</p>');
  } else {
    var ageMs = Date.now() - apiMs;
    var stale = ageMs > intervalMs;
    var critical = ageMs > intervalMs * 3;
    warnClass = critical ? ' argus-about-critical' : stale ? ' argus-about-warn' : '';
    lines.push(
      '<p class="argus-about-line' +
        warnClass +
        '">Last API ' +
        escapeHtml(formatClock(apiMs)) +
        ' · ' +
        escapeHtml(weatherDebugLog.formatAgeMinutes(ageMs)) +
        ' ago</p>'
    );
    if (critical) {
      lines.push(
        '<p class="argus-about-note argus-about-critical">Past 3× update interval (' +
          Math.round(intervalMs / 60000) +
          'm).</p>'
      );
    } else if (stale) {
      lines.push(
        '<p class="argus-about-note argus-about-warn">Past update interval (' +
          Math.round(intervalMs / 60000) +
          'm).</p>'
      );
    }
  }

  if (locationPending(cache, gps)) {
    lines.push(
      '<p class="argus-about-note argus-about-critical">Location changed since last weather fetch.</p>'
    );
  }

  if (options.pauseAtNight) {
    lines.push(
      '<p class="argus-about-note">Night pause on — purple header icon while paused.</p>'
    );
  }

  if (cache && cache.latQ != null && cache.lonQ != null) {
    lines.push(
      '<p class="argus-about-muted">Forecast for ' +
        escapeHtml(Number(cache.latQ).toFixed(2)) +
        ', ' +
        escapeHtml(Number(cache.lonQ).toFixed(2)) +
        '</p>'
    );
  }

  lines.push(
    '<p class="argus-about-muted argus-about-icons-heading">Header weather icons</p>' +
      '<p class="argus-about-line"><span class="argus-about-swatch argus-about-swatch-purple"></span> Purple — pause at night</p>' +
      '<p class="argus-about-line"><span class="argus-about-swatch argus-about-swatch-orange"></span> Orange — past update interval</p>' +
      '<p class="argus-about-line"><span class="argus-about-swatch argus-about-swatch-red"></span> Red — location pending or &gt;3× interval</p>'
  );

  return '<div class="argus-about-section">' + lines.join('') + '</div>';
}

function gpsSectionHtml(options) {
  var gps = readJson(LAST_GPS_FIX_KEY);
  var lines = [];
  lines.push('<div class="argus-setting-label">GPS</div>');

  if (options.locationMode === 'manual') {
    lines.push('<p class="argus-about-line">Manual location mode (GPS not used).</p>');
  } else if (!gps || !gps.t) {
    lines.push('<p class="argus-about-line">No GPS fix stored yet.</p>');
  } else {
    lines.push(
      '<p class="argus-about-line">Last fix ' +
        escapeHtml(formatClock(gps.t)) +
        ' · ' +
        escapeHtml(weatherDebugLog.formatAgeMinutes(Date.now() - gps.t)) +
        ' ago</p>'
    );
    if (gps.lat != null && gps.lon != null) {
      lines.push(
        '<p class="argus-about-muted">' +
          escapeHtml(Number(gps.lat).toFixed(2)) +
          ', ' +
          escapeHtml(Number(gps.lon).toFixed(2)) +
          '</p>'
      );
    }
  }

  return '<div class="argus-about-section">' + lines.join('') + '</div>';
}

function holidaySectionHtml(options) {
  var lines = [];
  lines.push('<div class="argus-setting-label">Holidays</div>');

  if (!options.showHolidays) {
    lines.push('<p class="argus-about-line">Holiday markings are off.</p>');
    return '<div class="argus-about-section">' + lines.join('') + '</div>';
  }

  var countryCode = options.countryCode || '';
  if (!countryCode) {
    lines.push('<p class="argus-about-line">No holiday country selected.</p>');
    return '<div class="argus-about-section">' + lines.join('') + '</div>';
  }

  var regionCode = options.regionCode || '';
  var regionName = regionDisplayName(countryCode, regionCode);
  var cached = holidays.readCachedHolidaysForWindow(
    countryCode,
    new Date(),
    options.weekStart || '0'
  );

  if (!cached.length) {
    lines.push(
      '<p class="argus-about-line">No cached holidays yet for ' +
        escapeHtml(countryCode) +
        (regionName ? ' / ' + escapeHtml(regionName) : '') +
        '.</p>'
    );
    return '<div class="argus-about-section">' + lines.join('') + '</div>';
  }

  var inWindow = holidays.listHolidaysInCalendarWindow(
    cached,
    regionCode,
    new Date(),
    options.weekStart || '0'
  );
  var upcoming = [];
  var i;
  for (i = 0; i < inWindow.length; i += 1) {
    if (!inWindow[i].isPast) {
      upcoming.push(inWindow[i]);
    }
  }

  if (!upcoming.length) {
    lines.push(
      '<p class="argus-about-line">No holidays in the current 14-day calendar window' +
        (regionName ? ' (' + escapeHtml(regionName) + ')' : '') +
        '.</p>'
    );
  } else {
    lines.push(
      '<p class="argus-about-muted">' +
        escapeHtml(countryCode) +
        (regionName ? ' · ' + escapeHtml(regionName) : '') +
        '</p>'
    );
    for (i = 0; i < upcoming.length && i < 4; i += 1) {
      var entry = upcoming[i];
      lines.push(
        '<p class="argus-about-line">' +
          escapeHtml(formatHolidayDate(entry)) +
          ' — ' +
          escapeHtml(entry.name) +
          (entry.national ? '' : ' <span class="argus-about-muted">(regional)</span>') +
          '</p>'
      );
    }
    if (upcoming.length > 4) {
      lines.push(
        '<p class="argus-about-muted">+' + (upcoming.length - 4) + ' more in window</p>'
      );
    }
  }

  return '<div class="argus-about-section">' + lines.join('') + '</div>';
}

function formatPanelHtml(options) {
  options = options || {};
  return (
    '<div class="argus-about">' +
    holidaySectionHtml(options) +
    gpsSectionHtml(options) +
    weatherSectionHtml(options) +
    '</div>'
  );
}

module.exports = {
  formatPanelHtml: formatPanelHtml,
};
