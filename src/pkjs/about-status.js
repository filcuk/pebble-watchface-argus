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

function formatSunClock(iso) {
  if (!iso) {
    return '';
  }
  var match = String(iso).match(/T(\d{2}):(\d{2})/);
  return match ? match[1] + ':' + match[2] : '';
}

function formatHmFromHours(hours) {
  if (hours == null || !isFinite(hours)) {
    return '';
  }
  var totalMinutes = Math.round((((hours % 24) + 24) % 24) * 60);
  var hh = Math.floor(totalMinutes / 60) % 24;
  var mm = totalMinutes % 60;
  var hhStr = hh < 10 ? '0' + hh : String(hh);
  var mmStr = mm < 10 ? '0' + mm : String(mm);
  return hhStr + ':' + mmStr;
}

function forecastLocalDateParts(nowMs, utcOffsetSeconds) {
  var shifted = new Date(nowMs + (utcOffsetSeconds || 0) * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    ymd:
      shifted.getUTCFullYear() +
      '-' +
      ('0' + (shifted.getUTCMonth() + 1)).slice(-2) +
      '-' +
      ('0' + shifted.getUTCDate()).slice(-2),
  };
}

function resolveForecastLatLon(cache, gps) {
  if (cache && cache.latQ != null && cache.lonQ != null) {
    return { lat: Number(cache.latQ), lon: Number(cache.lonQ) };
  }
  if (gps && gps.lat != null && gps.lon != null) {
    return { lat: Number(gps.lat), lon: Number(gps.lon) };
  }
  return null;
}

function resolveUtcOffsetSeconds(cache) {
  if (cache && typeof cache.utcOffsetSeconds === 'number') {
    return cache.utcOffsetSeconds;
  }
  /* Phone local offset when forecast timezone is unknown. */
  return -new Date().getTimezoneOffset() * 60;
}

function pickSunTimesFromCache(cache) {
  if (!cache || !cache.dailySunrise || !cache.dailySunset) {
    return null;
  }
  var sunrises = cache.dailySunrise;
  var sunsets = cache.dailySunset;
  if (!sunrises.length || !sunsets.length) {
    return null;
  }
  var today = forecastLocalDateParts(Date.now(), resolveUtcOffsetSeconds(cache)).ymd;
  var i;
  for (i = 0; i < sunrises.length && i < sunsets.length; i += 1) {
    if (String(sunrises[i]).indexOf(today) === 0) {
      return { sunup: formatSunClock(sunrises[i]), sundown: formatSunClock(sunsets[i]) };
    }
  }
  return {
    sunup: formatSunClock(sunrises[0]),
    sundown: formatSunClock(sunsets[0]),
  };
}

/* Compact NOAA-style sunrise/sunset in local hours for lat/lon. */
function calcSunTimesLocal(lat, lon, utcOffsetSeconds, nowMs) {
  var parts = forecastLocalDateParts(nowMs || Date.now(), utcOffsetSeconds);
  var rad = Math.PI / 180;
  var dayOfYear =
    Math.floor((275 * parts.month) / 9) -
    (Math.floor((parts.month + 9) / 12) *
      (1 + Math.floor((parts.year - 4 * Math.floor(parts.year / 4) + 2) / 3))) +
    parts.day -
    30;
  var lngHour = lon / 15;

  function eventLocalHours(rising) {
    var t = rising ? dayOfYear + (6 - lngHour) / 24 : dayOfYear + (18 - lngHour) / 24;
    var M = 0.9856 * t - 3.289;
    var L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
    L = ((L % 360) + 360) % 360;
    var RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = ((RA % 360) + 360) % 360;
    var Lquadrant = Math.floor(L / 90) * 90;
    var RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;
    var sinDec = 0.39782 * Math.sin(L * rad);
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH =
      (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) /
      (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) {
      return null;
    }
    var H = rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H /= 15;
    var T = H + RA - 0.06571 * t - 6.622;
    var UT = ((T - lngHour) % 24 + 24) % 24;
    return UT + utcOffsetSeconds / 3600;
  }

  var sunupHours = eventLocalHours(true);
  var sundownHours = eventLocalHours(false);
  if (sunupHours == null && sundownHours == null) {
    return null;
  }
  return {
    sunup: formatHmFromHours(sunupHours),
    sundown: formatHmFromHours(sundownHours),
  };
}

function pickSunTimesCalculated(cache, gps) {
  var coords = resolveForecastLatLon(cache, gps);
  if (!coords || !isFinite(coords.lat) || !isFinite(coords.lon)) {
    return null;
  }
  return calcSunTimesLocal(coords.lat, coords.lon, resolveUtcOffsetSeconds(cache));
}

function pickSunTimesFromIsDay(cache) {
  var bytes =
    (cache && cache.isDayBytes) ||
    (cache && cache.payload && cache.payload.isDayBytes) ||
    null;
  var fetchTime =
    (cache && cache.fetchTime) ||
    (cache && cache.payload && cache.payload.fetchTime) ||
    0;
  var count =
    (cache && cache.count) || (cache && cache.payload && cache.payload.count) || 0;
  if (!bytes || !fetchTime || !count) {
    return null;
  }
  var offset = resolveUtcOffsetSeconds(cache);
  var sunup = '';
  var sundown = '';
  var i;
  for (i = 1; i < count; i += 1) {
    var hourEpoch = fetchTime + i * 3600;
    if (!sunup && bytes[i - 1] === 0 && bytes[i] === 1) {
      sunup = formatHmFromEpoch(hourEpoch, offset);
    }
    if (!sundown && bytes[i - 1] === 1 && bytes[i] === 0) {
      sundown = formatHmFromEpoch(hourEpoch, offset);
    }
  }
  if (!sunup && !sundown) {
    return null;
  }
  return { sunup: sunup, sundown: sundown };
}

function formatHmFromEpoch(epochSeconds, utcOffsetSeconds) {
  var shifted = new Date(epochSeconds * 1000 + (utcOffsetSeconds || 0) * 1000);
  var hh = shifted.getUTCHours();
  var mm = shifted.getUTCMinutes();
  var hhStr = hh < 10 ? '0' + hh : String(hh);
  var mmStr = mm < 10 ? '0' + mm : String(mm);
  return hhStr + ':' + mmStr;
}

function sunTimesLineHtml(cache, gps) {
  var times =
    pickSunTimesFromCache(cache) ||
    pickSunTimesCalculated(cache, gps) ||
    pickSunTimesFromIsDay(cache);
  if (!times || (!times.sunup && !times.sundown)) {
    return '';
  }
  var parts = [];
  if (times.sunup) {
    parts.push('Sunrise ' + escapeHtml(times.sunup));
  }
  if (times.sundown) {
    parts.push('Sunset ' + escapeHtml(times.sundown));
  }
  return '<p class="argus-about-muted argus-about-line">' + parts.join(' · ') + '</p>';
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

  if (locationPending(cache, gps)) {
    lines.push(
      '<p class="argus-about-note argus-about-critical">Location changed since last weather update.</p>'
    );
  }

  if (options.pauseAtNight) {
    lines.push(
      '<p class="argus-about-note">Weather updates paused - nighttime setting.</p>'
    );
  }

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
        '">Last API call at ' +
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

  var sunLine = sunTimesLineHtml(cache, gps);
  if (sunLine) {
    lines.push(sunLine);
  }

  lines.push(
    '<p class="argus-about-icons-heading">Weather status</p>' +
      '<p class="argus-about-line"><span class="argus-about-swatch argus-about-swatch-purple"></span> Purple:  updates paused</p>' +
      '<p class="argus-about-line"><span class="argus-about-swatch argus-about-swatch-orange"></span> Orange: older than set interval</p>' +
      '<p class="argus-about-line"><span class="argus-about-swatch argus-about-swatch-red"></span> Red: pending or age &gt; 3× interval</p>'
  );

  return '<div class="argus-about-section">' + lines.join('') + '</div>';
}

function forecastCoordsLineHtml(cache) {
  if (!cache || cache.latQ == null || cache.lonQ == null) {
    return '';
  }
  return (
    '<p class="argus-about-muted">' +
    escapeHtml(Number(cache.latQ).toFixed(2)) +
    ', ' +
    escapeHtml(Number(cache.lonQ).toFixed(2)) +
    '</p>'
  );
}

function gpsSectionHtml(options) {
  var gps = readJson(LAST_GPS_FIX_KEY);
  var cache = readJson(WEATHER_FETCH_CACHE_KEY);
  var lines = [];
  lines.push('<div class="argus-setting-label">GPS</div>');

  if (options.locationMode === 'manual') {
    var city = (options.manualLocation || '').trim();
    lines.push(
      '<p class="argus-about-line">Manual location: ' +
        escapeHtml(city || '—') +
        '</p>'
    );
    var manualCoords = forecastCoordsLineHtml(cache);
    if (manualCoords) {
      lines.push(manualCoords);
    }
  } else if (!gps || !gps.t) {
    lines.push('<p class="argus-about-line">No GPS fix stored yet.</p>');
  } else {
    lines.push(
      '<p class="argus-about-line">Last fix ' +
        escapeHtml(formatClock(gps.t)) +
        ' · ' +
        escapeHtml(weatherDebugLog.formatAgeMs(Date.now() - gps.t)) +
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
          ' - ' +
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
