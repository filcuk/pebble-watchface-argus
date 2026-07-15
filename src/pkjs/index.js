var Clay = require('@rebble/clay');
var clayConfig = require('./config');
var customClay = require('./custom-clay');
var holidays = require('./holidays');
var aboutStatus = require('./about-status');
var pkg = require('../../package.json');
var release = require('./release');
var keys = require('message_keys');
var weatherDebugLog = require('./weather-debug-log');

/**
 * Read a field from a watch→phone AppMessage payload.
 * rePebble may deliver keys as message_keys numeric ids and/or package.json
 * string names — never use payload[keys.Foo] alone when reading.
 */
function appMessagePayloadGet(payload, keyName) {
  if (!payload || !keyName) {
    return undefined;
  }
  var id = keys[keyName];
  if (id !== undefined && id !== null && payload[id] !== undefined && payload[id] !== null) {
    return payload[id];
  }
  if (payload[keyName] !== undefined && payload[keyName] !== null) {
    return payload[keyName];
  }
  if (id !== undefined && id !== null) {
    var asString = String(id);
    if (payload[asString] !== undefined && payload[asString] !== null) {
      return payload[asString];
    }
  }
  return undefined;
}

function appMessagePayloadHas(payload, keyName) {
  return appMessagePayloadGet(payload, keyName) !== undefined;
}

var clayUserData = {
  version: pkg.version,
  githubUrl: 'https://github.com/filcuk/pebble-watchface-argus',
  weatherLog: [],
};

var clay = new Clay(clayConfig, customClay, {
  autoHandleEvents: false,
  userData: clayUserData,
});

var weatherFetchInFlight = false;
var weatherFetchStartedAt = 0;
var weatherRequestTimer = null;
var weatherRetryTimer = null;
var weatherRetryDelayMs = 0;
var weatherRetryContext = null;
var holidayRequestTimer = null;
var holidayFetchInFlight = false;
var WEATHER_FETCH_STALE_MS = 30000;
var WEATHER_RETRY_BASE_MS = 30 * 1000;
var WEATHER_RETRY_CAP_MS = 30 * 60 * 1000;
var weatherFetchCache = null;
var RELEASE_SEEN_KEY = 'argus-release-seen';
var RELEASE_NOTIFICATION_NORMAL = '0';
var RELEASE_NOTIFICATION_ALWAYS = '1';
var RELEASE_NOTIFICATION_NEVER = '2';
var releaseNoticeShownThisSession = false;

var WEATHER_PROVIDER_MODELS = {
  '1': 'ecmwf_ifs025',
  '2': 'gfs_seamless',
  '3': 'icon_seamless',
  '4': 'meteofrance_seamless',
  '5': 'jma_seamless',
  '6': 'gem_seamless',
  '7': 'ukmo_seamless',
};

var GPS_MAX_AGE_MS = {
  '15': 15 * 60 * 1000,
  '30': 30 * 60 * 1000,
  '60': 60 * 60 * 1000,
  '120': 120 * 60 * 1000,
  '360': 360 * 60 * 1000,
};

var NIGHT_FALLBACK_START_HOUR = 20;
var NIGHT_FALLBACK_END_HOUR = 6;

function clearWeatherFetchInFlight() {
  weatherFetchInFlight = false;
  weatherFetchStartedAt = 0;
}

function weatherFetchIsStale() {
  return weatherFetchInFlight && Date.now() - weatherFetchStartedAt >= WEATHER_FETCH_STALE_MS;
}

function getWeatherRetryCapMs() {
  var intervalMs = getWeatherUpdateIntervalMs();
  var cap = Math.min(intervalMs, WEATHER_RETRY_CAP_MS);
  return Math.max(cap, WEATHER_RETRY_BASE_MS);
}

function resetWeatherRetryBackoff() {
  weatherRetryDelayMs = 0;
  weatherRetryContext = null;
  if (weatherRetryTimer) {
    clearTimeout(weatherRetryTimer);
    weatherRetryTimer = null;
  }
}

function cancelWeatherApiRetryTimer() {
  if (weatherRetryTimer) {
    clearTimeout(weatherRetryTimer);
    weatherRetryTimer = null;
  }
}

function scheduleWeatherApiRetry() {
  if (weatherRetryTimer) {
    return;
  }

  var cap = getWeatherRetryCapMs();
  var delay = weatherRetryDelayMs === 0 ? WEATHER_RETRY_BASE_MS : weatherRetryDelayMs;
  if (delay > cap) {
    delay = cap;
  }
  weatherRetryDelayMs = Math.min(delay * 2, cap);

  var context = weatherRetryContext || {};
  var retryOptions = {};
  var key;
  var sourceOptions = context.options || {};
  for (key in sourceOptions) {
    if (Object.prototype.hasOwnProperty.call(sourceOptions, key)) {
      retryOptions[key] = sourceOptions[key];
    }
  }
  retryOptions.forceRefresh = true;
  wlog('RETRY', Math.round(delay / 1000) + 's');
  weatherRetryTimer = setTimeout(function () {
    weatherRetryTimer = null;
    getWeather(context.forEpoch || null, retryOptions);
  }, delay);
}

function normalizeStoredClaySettings(settings) {
  if (!settings) {
    return settings;
  }

  var normalized = {};
  var key;
  for (key in settings) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      normalized[key] = settings[key];
    }
  }

  var steps = normalized.RealtimeSteps;
  if (steps && typeof steps === 'object' && 'value' in steps) {
    steps = steps.value;
  }

  if (steps !== '0' && steps !== '1' && steps !== '2') {
    if (steps === true || steps === 'true' || steps === 1) {
      normalized.RealtimeSteps = '1';
    } else {
      normalized.RealtimeSteps = '0';
    }
  }

  if (normalized.ReleaseNotification !== '0' &&
      normalized.ReleaseNotification !== '1' &&
      normalized.ReleaseNotification !== '2') {
    var legacyIgnore = normalized.IgnoreReleaseNotice;
    if (legacyIgnore && typeof legacyIgnore === 'object' && 'value' in legacyIgnore) {
      legacyIgnore = legacyIgnore.value;
    }
    if (legacyIgnore === true || legacyIgnore === 'true' || legacyIgnore === 1 || legacyIgnore === '1') {
      normalized.ReleaseNotification = RELEASE_NOTIFICATION_NEVER;
    } else {
      normalized.ReleaseNotification = RELEASE_NOTIFICATION_NORMAL;
    }
  }

  return normalized;
}

function getStoredClaySettings() {
  try {
    var raw = localStorage.getItem('clay-settings');
    if (!raw) {
      return null;
    }
    var settings = JSON.parse(raw);
    if (!settings || Object.keys(settings).length === 0) {
      return null;
    }
    return normalizeStoredClaySettings(settings);
  } catch (e) {
    return null;
  }
}

function getClaySetting(key, defaultValue) {
  var settings = getStoredClaySettings();
  if (!settings) {
    return defaultValue;
  }
  if (settings[key] === undefined || settings[key] === null) {
    return defaultValue;
  }
  var value = settings[key];
  if (value && typeof value === 'object' && 'value' in value) {
    value = value.value;
  }
  return value;
}

var APP_MESSAGE_INT_BATCH = 4;
/** Clay config keys stored on phone only; not in package.json messageKeys. */
var CLAY_PKJS_ONLY_KEYS = ['DebugWeatherLog'];
/** Settings that change the weather fetch identity — force refresh when they change. */
var WEATHER_FETCH_SETTING_KEYS = [
  'LocationMode',
  'ManualLocation',
  'ForecastHours',
  'WeatherProvider',
];

function parseClayWebviewResponse(response) {
  var raw = String(response).match(/^\{/) ? String(response) : decodeURIComponent(String(response));
  return JSON.parse(raw);
}

function stripPkjsOnlyClayKeys(raw) {
  var i;
  for (i = 0; i < CLAY_PKJS_ONLY_KEYS.length; i += 1) {
    delete raw[CLAY_PKJS_ONLY_KEYS[i]];
  }
  return raw;
}

function flattenClayRaw(raw) {
  var flat = {};
  var key;
  for (key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) {
      continue;
    }
    var entry = raw[key];
    if (entry && typeof entry === 'object' && 'value' in entry) {
      flat[key] = entry.value;
    } else {
      flat[key] = entry;
    }
  }
  return flat;
}

function claySettingValuesEqual(a, b) {
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

function weatherFetchSettingsChanged(prevFlat, nextFlat) {
  var i;
  var key;
  prevFlat = prevFlat || {};
  nextFlat = nextFlat || {};
  for (i = 0; i < WEATHER_FETCH_SETTING_KEYS.length; i += 1) {
    key = WEATHER_FETCH_SETTING_KEYS[i];
    if (!claySettingValuesEqual(prevFlat[key], nextFlat[key])) {
      return true;
    }
  }
  return false;
}

function persistClaySettingsFromRaw(raw) {
  var flat = flattenClayRaw(raw);
  try {
    localStorage.setItem('clay-settings', JSON.stringify(flat));
  } catch (err) {
    // Ignore storage errors.
  }
}

function sendPreparedSettingsInChunks(prepared, onComplete, onError) {
  var intKeys = [];
  var stringKeys = [];
  var key;

  for (key in prepared) {
    if (!Object.prototype.hasOwnProperty.call(prepared, key)) {
      continue;
    }
    if (!isFinite(Number(key))) {
      continue;
    }
    if (typeof prepared[key] === 'string') {
      stringKeys.push(key);
    } else {
      intKeys.push(key);
    }
  }

  function done(err) {
    if (err) {
      console.log('Settings chunk send failed: ' + JSON.stringify(err));
      if (onError) {
        onError(err);
      } else if (onComplete) {
        onComplete(err);
      }
      return;
    }
    if (onComplete) {
      onComplete();
    }
  }

  function sendStringBatch(index) {
    if (index >= stringKeys.length) {
      done(null);
      return;
    }
    var payload = {};
    payload[stringKeys[index]] = prepared[stringKeys[index]];
    Pebble.sendAppMessage(payload, function () {
      sendStringBatch(index + 1);
    }, done);
  }

  function sendIntBatch(index) {
    if (index >= intKeys.length) {
      sendStringBatch(0);
      return;
    }
    var payload = {};
    var count = 0;
    var i = index;
    while (i < intKeys.length && count < APP_MESSAGE_INT_BATCH) {
      payload[intKeys[i]] = prepared[intKeys[i]];
      i++;
      count++;
    }
    Pebble.sendAppMessage(payload, function () {
      sendIntBatch(i);
    }, done);
  }

  sendIntBatch(0);
}

function sendStoredSettings(onComplete) {
  var settings = getStoredClaySettings();
  if (!settings) {
    if (onComplete) {
      onComplete();
    }
    return;
  }

  // Debug/capture runs apply settings from the CLI; skip Clay sync so phone
  // localStorage (e.g. ClockFont) does not overwrite the scenario setup.
  if (String(getClaySetting('DebugMode', '0')) === '1') {
    console.log('Debug mode: skipping stored Clay settings sync');
    if (onComplete) {
      onComplete();
    }
    return;
  }

  sendPreparedSettingsInChunks(
    Clay.prepareSettingsForAppMessage(settings),
    function () {
      console.log('Stored settings synced to watch');
      if (onComplete) {
        onComplete();
      }
    },
    function () {
      if (onComplete) {
        onComplete();
      }
    }
  );
}

function xhrRequest(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    if (this.status >= 200 && this.status < 300) {
      callback(this.responseText);
    } else {
      console.log('XHR status ' + this.status + ' for ' + url);
      callback(null);
    }
  };
  xhr.onerror = function () {
    console.log('XHR error for ' + url);
    callback(null);
  };
  xhr.open('GET', url);
  xhr.send();
}

function getForecastHours() {
  var hours = parseInt(getClaySetting('ForecastHours', '24'), 10);
  if (hours !== 12 && hours !== 24 && hours !== 48) {
    hours = 24;
  }
  return hours;
}

function getLocationMode(options) {
  options = options || {};
  if (options.locationMode !== undefined && options.locationMode !== null) {
    return String(options.locationMode) === '1' ? 'manual' : 'gps';
  }
  return getClaySetting('LocationMode', '0') === '1' ? 'manual' : 'gps';
}

function getManualLocation(options) {
  options = options || {};
  if (options.manualLocation) {
    return options.manualLocation;
  }
  return getClaySetting('ManualLocation', '') || '';
}

function getWeatherProvider() {
  return String(getClaySetting('WeatherProvider', '0'));
}

function getWeatherProviderModel() {
  return WEATHER_PROVIDER_MODELS[getWeatherProvider()] || null;
}

function getWeatherUpdateIntervalMs() {
  var minutes = parseInt(getClaySetting('WeatherUpdateInterval', '60'), 10);
  if (minutes !== 5 && minutes !== 15 && minutes !== 30 && minutes !== 60 && minutes !== 120 &&
      minutes !== 180) {
    minutes = 60;
  }
  return minutes * 60 * 1000;
}

function getGpsMaxAgeMs() {
  var value = String(getClaySetting('GpsMaxAge', '60'));
  return GPS_MAX_AGE_MS[value] || GPS_MAX_AGE_MS['60'];
}

function gpsCacheExpiryMs() {
  /* Near-miss gate: same 80% threshold as weatherFetchCacheExpiryMs(), so a
   * periodic weather check near the end of GpsMaxAge still forces a fresh fix. */
  return (getGpsMaxAgeMs() * 4) / 5;
}

function claySettingIsTruthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function pauseWeatherAtNightEnabled() {
  return claySettingIsTruthy(getClaySetting('PauseWeatherAtNight', false));
}

function wlog(tag, msg) {
  weatherDebugLog.append(tag, msg);
}

var WEATHER_REQ_KINDS = {
  '0': 'periodic',
  '1': 'force',
  '2': 'stale',
};

var WEATHER_WATCH_SKIP_LABELS = {
  '1': 'watch night pause',
  '2': 'watch offline+cache',
  '3': 'watch offline no data',
  '4': 'watch throttle 60s',
};

var LAST_GPS_FIX_KEY = 'argus-last-gps-fix';
var WEATHER_STATUS_LOCATION_PENDING = 1;

function quantizeCoord(value) {
  return Math.round(value * 100) / 100;
}

function coordToE4(value) {
  return Math.round(quantizeCoord(value) * 10000);
}

function cacheApiFetchedAt(cache) {
  if (!cache) {
    return 0;
  }
  return cache.apiFetchedAt || cache.fetchedAt || 0;
}

function cacheHasLocationPending(latitude, longitude, model, hours, startEpoch) {
  var cache = readWeatherFetchCache();
  if (!cache || !cache.key) {
    return false;
  }
  var expectedKey = weatherFetchCacheKey(latitude, longitude, model, hours, startEpoch);
  if (cache.key === expectedKey) {
    return false;
  }
  var cachedKey = parseWeatherCacheKey(cache.key);
  var qLat = quantizeCoord(latitude);
  var qLon = quantizeCoord(longitude);
  return !!(cachedKey && (cachedKey.lat !== qLat || cachedKey.lon !== qLon));
}

function buildSendMeta(latitude, longitude, cache, statusFlags) {
  var meta = {
    statusFlags: statusFlags || 0,
  };
  if (cache) {
    var apiMs = cacheApiFetchedAt(cache);
    if (apiMs > 0) {
      meta.apiFetchedAt = Math.floor(apiMs / 1000);
    }
    if (cache.latQ !== undefined && cache.lonQ !== undefined) {
      meta.apiLatE4 = coordToE4(cache.latQ);
      meta.apiLonE4 = coordToE4(cache.lonQ);
    } else {
      var parsed = parseWeatherCacheKey(cache.key);
      if (parsed) {
        meta.apiLatE4 = coordToE4(parsed.lat);
        meta.apiLonE4 = coordToE4(parsed.lon);
      }
    }
  } else if (latitude !== undefined && longitude !== undefined) {
    meta.apiFetchedAt = Math.floor(Date.now() / 1000);
    meta.apiLatE4 = coordToE4(latitude);
    meta.apiLonE4 = coordToE4(longitude);
  }
  return meta;
}

function writeLastGpsFix(latitude, longitude, timestamp) {
  try {
    localStorage.setItem(
      LAST_GPS_FIX_KEY,
      JSON.stringify({
        lat: quantizeCoord(latitude),
        lon: quantizeCoord(longitude),
        t: timestamp || Date.now(),
      })
    );
  } catch (e) {
    // Ignore storage errors.
  }
}

function readLastGpsFix() {
  try {
    var raw = localStorage.getItem(LAST_GPS_FIX_KEY);
    if (!raw) {
      return null;
    }
    var parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.lat !== 'number' ||
      typeof parsed.lon !== 'number' ||
      typeof parsed.t !== 'number' ||
      !isFinite(parsed.t)
    ) {
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

function normalizeGpsTimestamp(pos) {
  var raw = pos && pos.timestamp;
  if ((raw === undefined || raw === null) && pos && pos.coords) {
    raw = pos.coords.timestamp;
  }
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  if (typeof raw === 'object' && typeof raw.getTime === 'function') {
    raw = raw.getTime();
  } else if (typeof raw === 'string') {
    var asNum = Number(raw);
    if (isFinite(asNum) && asNum > 0) {
      raw = asNum;
    } else {
      raw = Date.parse(raw);
      if (!isFinite(raw)) {
        return null;
      }
    }
  }
  var n = Number(raw);
  if (!isFinite(n) || n <= 0) {
    return null;
  }
  /* Some WebViews report seconds since epoch instead of ms. */
  if (n < 1e12) {
    n *= 1000;
  }
  return n;
}

function formatGpsLogMsg(latitude, longitude, recordedAt, nowMs) {
  return (
    Number(latitude).toFixed(2) +
    ',' +
    Number(longitude).toFixed(2) +
    ' ' +
    weatherDebugLog.formatAgeMs(nowMs - recordedAt)
  );
}

function wlogGpsPosition(pos) {
  var latitude = quantizeCoord(pos.coords.latitude);
  var longitude = quantizeCoord(pos.coords.longitude);
  var fixTime = normalizeGpsTimestamp(pos);
  var nowMs = Date.now();
  /* Prefer OS fix time when present; otherwise stamp receive time so later
     phone-side reuse can log a real age (many WebViews omit timestamps). */
  var recordedAt = fixTime != null ? fixTime : nowMs;
  writeLastGpsFix(latitude, longitude, recordedAt);
  wlog('GPS', formatGpsLogMsg(latitude, longitude, recordedAt, nowMs));
}

function wlogGpsCacheReuse(last) {
  wlog('GPS', formatGpsLogMsg(last.lat, last.lon, last.t, Date.now()));
}

function wlogWeatherRequestKind(kind, reqDetail) {
  var kindKey = String(kind);
  var label = WEATHER_REQ_KINDS[kindKey];
  if (!label) {
    label = kind === undefined || kind === null ? 'request' : 'kind' + kindKey;
  }
  if (reqDetail) {
    wlog('REQ', label + ' ' + reqDetail);
  } else {
    wlog('REQ', label);
  }
}

function wlogWeatherWatchSkip(code) {
  var label = WEATHER_WATCH_SKIP_LABELS[String(code)] || 'watch code ' + code;
  wlog('SKIP', label);
}

function prepareClayUserData() {
  if (!clay.meta) {
    clay.meta = {};
  }
  clay.meta.userData = {
    version: clayUserData.version,
    githubUrl: clayUserData.githubUrl,
  };
}

function setClayConfigDefaultById(id, html) {
  var config = clay.config;
  var i;
  for (i = 0; i < config.length; i += 1) {
    if (config[i].id === id) {
      config[i].defaultValue = html;
      return;
    }
  }
}

function injectWeatherLogForClayConfig() {
  var html = '';
  if (claySettingIsTruthy(getClaySetting('DebugWeatherLog', false))) {
    html = weatherDebugLog.formatPanelHtml(weatherDebugLog.read());
  }
  setClayConfigDefaultById('argus-weather-debug-log', html);
}

function injectAboutStatusForClayConfig() {
  var weatherCache = readWeatherFetchCache();
  setClayConfigDefaultById(
    'argus-about-status',
    aboutStatus.formatPanelHtml({
      intervalMs: getWeatherUpdateIntervalMs(),
      locationMode: getLocationMode(),
      manualLocation: getManualLocation(),
      showHolidays: claySettingIsTruthy(getClaySetting('ShowHolidays', true)),
      countryCode: String(getClaySetting('HolidayCountry', '') || ''),
      regionCode: String(getClaySetting('HolidayRegion', '') || ''),
      weekStart: String(getClaySetting('WeekStart', '0')),
      pauseAtNight:
        pauseWeatherAtNightEnabled() && !!weatherCache && weatherIsNightNow(weatherCache),
    })
  );
}

function injectClayConfigPanels() {
  prepareClayUserData();
  injectAboutStatusForClayConfig();
  injectWeatherLogForClayConfig();
}

function parseWeatherCacheKey(key) {
  if (!key) {
    return null;
  }
  var parts = String(key).split(',');
  if (parts.length < 5) {
    return null;
  }
  return {
    lat: parseFloat(parts[0]),
    lon: parseFloat(parts[1]),
    model: parts[2],
    hours: parseInt(parts[3], 10),
    startEpoch: parseInt(parts[4], 10) || 0,
  };
}

function wlogCacheMiss(latitude, longitude, model, hours, startEpoch) {
  var cache = readWeatherFetchCache();
  var expectedKey = weatherFetchCacheKey(latitude, longitude, model, hours, startEpoch);
  if (!cache) {
    wlog('C-', 'empty');
    return;
  }
  if (cache.key !== expectedKey) {
    var cachedKey = parseWeatherCacheKey(cache.key);
    var qLat = quantizeCoord(latitude);
    var qLon = quantizeCoord(longitude);
    if (cachedKey && (cachedKey.lat !== qLat || cachedKey.lon !== qLon)) {
      wlog('C-', 'pos change');
      return;
    }
    wlog('C-', 'settings');
    return;
  }
  wlog('C-', 'expired ' + weatherDebugLog.formatAgeMs(Date.now() - cacheApiFetchedAt(cache)));
}

function readWeatherFetchCache() {
  if (weatherFetchCache) {
    return weatherFetchCache;
  }
  try {
    var raw = localStorage.getItem('weather-fetch-cache');
    if (!raw) {
      return null;
    }
    weatherFetchCache = JSON.parse(raw);
    return weatherFetchCache;
  } catch (e) {
    return null;
  }
}

function writeWeatherFetchCache(entry) {
  weatherFetchCache = entry;
  try {
    localStorage.setItem('weather-fetch-cache', JSON.stringify(entry));
  } catch (e) {
    console.log('Weather fetch cache write failed');
  }
}

function weatherFetchCacheKey(latitude, longitude, model, hours, startEpoch) {
  return (
    quantizeCoord(latitude).toFixed(2) +
    ',' +
    quantizeCoord(longitude).toFixed(2) +
    ',' +
    (model || 'auto') +
    ',' +
    hours +
    ',' +
    (startEpoch || 0)
  );
}

function cacheCoversHour(cache, epochSeconds) {
  if (!cache || !cache.payload) {
    return false;
  }
  var fetchTime = cache.payload.fetchTime || cache.fetchTime;
  var count = cache.payload.count || cache.count;
  if (!fetchTime || !count) {
    return false;
  }
  var hourStart = hourStartEpoch(epochSeconds || Math.floor(Date.now() / 1000));
  var index = Math.floor((hourStart - fetchTime) / 3600);
  return index >= 0 && index < count;
}

function weatherFetchCacheExpiryMs() {
  /* Near-miss gate: treat cache as expired once age reaches 80% of the update
   * interval (within 20% of expiring). Periodic watch checks a few seconds early
   * then still refresh instead of serving a nearly-stale cache for another cycle. */
  return (getWeatherUpdateIntervalMs() * 4) / 5;
}

function shouldUseFetchCache(latitude, longitude, model, hours, startEpoch) {
  var cache = readWeatherFetchCache();
  if (!cache) {
    return false;
  }
  if (cache.key !== weatherFetchCacheKey(latitude, longitude, model, hours, startEpoch)) {
    return false;
  }
  if (Date.now() - cacheApiFetchedAt(cache) >= weatherFetchCacheExpiryMs()) {
    return false;
  }
  /* Age alone is not enough — reused payloads must still cover "now" (or forEpoch). */
  return cacheCoversHour(cache, startEpoch || Math.floor(Date.now() / 1000));
}

function weatherIsNightNow(cache) {
  var now = new Date();
  var hour = now.getHours();

  if (cache && cache.isDayBytes && cache.fetchTime && cache.count) {
    var nowEpoch = Math.floor(now.getTime() / 1000);
    var currentHourStart = hourStartEpoch(nowEpoch);
    var index = Math.floor((currentHourStart - cache.fetchTime) / 3600);
    if (index >= 0 && index < cache.count && cache.isDayBytes[index] === 0) {
      return true;
    }
    if (index >= 0 && index < cache.count && cache.isDayBytes[index] === 1) {
      return false;
    }
  }

  return hour >= NIGHT_FALLBACK_START_HOUR || hour < NIGHT_FALLBACK_END_HOUR;
}

function packInt8Array(values, count) {
  var arr = [];
  for (var i = 0; i < count; i++) {
    var v = Math.round(values[i] || 0);
    v = Math.min(127, Math.max(-128, v));
    arr.push(v < 0 ? v + 256 : v);
  }
  return arr;
}

function packUint8Array(values, count) {
  var arr = [];
  for (var i = 0; i < count; i++) {
    arr.push(Math.min(255, Math.max(0, Math.round(values[i] || 0))));
  }
  return arr;
}

function parseOpenMeteoTime(iso, utcOffsetSeconds) {
  if (!iso) {
    return Math.floor(Date.now() / 1000);
  }
  var parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!parts) {
    return Math.floor(Date.now() / 1000);
  }
  var offsetSec = typeof utcOffsetSeconds === 'number' ? utcOffsetSeconds : 0;
  /* Open-Meteo hourly times are wall-clock in the forecast timezone, not the phone's. */
  var utcMs =
    Date.UTC(
      parseInt(parts[1], 10),
      parseInt(parts[2], 10) - 1,
      parseInt(parts[3], 10),
      parseInt(parts[4], 10),
      parseInt(parts[5], 10)
    ) -
    offsetSec * 1000;
  return Math.floor(utcMs / 1000);
}

function formatDateYYYYMMDD(epochSeconds) {
  var d = new Date(epochSeconds * 1000);
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

function hourStartEpoch(epochSeconds) {
  var d = new Date(epochSeconds * 1000);
  d.setMinutes(0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function extractDailySunTimes(json) {
  var daily = json && json.daily;
  if (!daily || !daily.sunrise || !daily.sunset) {
    return null;
  }
  return {
    sunrise: daily.sunrise.slice(),
    sunset: daily.sunset.slice(),
  };
}

function packWeatherPayload(json, hours, startEpoch) {
  var times = json.hourly.time || [];
  var temps = json.hourly.temperature_2m;
  var feelsTemps = json.hourly.apparent_temperature || [];
  var precips = json.hourly.precipitation;
  var winds = json.hourly.wind_speed_10m || [];
  var isDay = json.hourly.is_day || [];
  var utcOffset =
    typeof json.utc_offset_seconds === 'number' ? json.utc_offset_seconds : 0;

  var startIndex = 0;
  if (startEpoch) {
    startIndex = -1;
    for (var i = 0; i < times.length; i++) {
      if (parseOpenMeteoTime(times[i], utcOffset) >= startEpoch) {
        startIndex = i;
        break;
      }
    }
    if (startIndex < 0) {
      return null;
    }
  }

  var available = temps.length - startIndex;
  var count = Math.min(hours, available, precips.length - startIndex);
  if (winds.length > 0) {
    count = Math.min(count, winds.length - startIndex);
  }
  if (feelsTemps.length > 0) {
    count = Math.min(count, feelsTemps.length - startIndex);
  }

  var tempMin = 127;
  var tempMax = -128;
  var feelsTempMin = 127;
  var feelsTempMax = -128;
  var precipMax = 0;
  var windMax = 0;
  var hasFeels = feelsTemps.length > 0;

  for (var i = 0; i < count; i++) {
    var src = startIndex + i;
    var temp = Math.round(temps[src]);
    var feelsTemp = hasFeels ? Math.round(feelsTemps[src]) : temp;
    var precip = Math.round(precips[src] * 10);
    var wind = Math.round(winds[src] || 0);
    if (precip > 255) {
      precip = 255;
    }
    if (wind > 255) {
      wind = 255;
    }
    if (temp < tempMin) {
      tempMin = temp;
    }
    if (temp > tempMax) {
      tempMax = temp;
    }
    if (hasFeels) {
      if (feelsTemp < feelsTempMin) {
        feelsTempMin = feelsTemp;
      }
      if (feelsTemp > feelsTempMax) {
        feelsTempMax = feelsTemp;
      }
    }
    if (precip > precipMax) {
      precipMax = precip;
    }
    if (wind > windMax) {
      windMax = wind;
    }
  }

  if (count === 0) {
    return null;
  }

  if (tempMax <= tempMin) {
    tempMax = tempMin + 1;
  }
  if (hasFeels && feelsTempMax <= feelsTempMin) {
    feelsTempMax = feelsTempMin + 1;
  }
  if (precipMax === 0) {
    precipMax = 1;
  }
  if (windMax === 0) {
    windMax = 1;
  }

  return {
    count: count,
    tempMin: tempMin,
    tempMax: tempMax,
    feelsTempMin: feelsTempMin,
    feelsTempMax: feelsTempMax,
    precipMax: precipMax,
    windMax: windMax,
    tempBytes: packInt8Array(
      temps.slice(startIndex, startIndex + count),
      count
    ),
    feelsTempBytes: hasFeels
      ? packInt8Array(feelsTemps.slice(startIndex, startIndex + count), count)
      : null,
    precipBytes: packUint8Array(
      precips.slice(startIndex, startIndex + count).map(function (p) {
        return Math.round(p * 10);
      }),
      count
    ),
    windBytes: packUint8Array(winds.slice(startIndex, startIndex + count), count),
    isDayBytes: packUint8Array(isDay.slice(startIndex, startIndex + count), count),
    fetchTime: parseOpenMeteoTime(times[startIndex], utcOffset),
  };
}

function notifyWeatherFetchFailed(reason) {
  clearWeatherFetchInFlight();
  var dict = {};
  dict[keys.WeatherHourCount] = 0;
  Pebble.sendAppMessage(
    dict,
    function () {
      console.log('Weather fetch failure sent to watch');
    },
    function (e) {
      console.log('Weather fetch failure send failed: ' + JSON.stringify(e));
    }
  );
  scheduleWeatherApiRetry();
}

function sendWeatherPayload(payload, sendMeta, sendOptions) {
  if (!payload) {
    clearWeatherFetchInFlight();
    return;
  }

  sendMeta = sendMeta || {};
  sendOptions = sendOptions || {};

  var dict = {};
  dict[keys.WeatherHourCount] = payload.count;
  dict[keys.TempMin] = payload.tempMin;
  dict[keys.TempMax] = payload.tempMax;
  dict[keys.FeelsTempMin] = payload.feelsTempMin;
  dict[keys.FeelsTempMax] = payload.feelsTempMax;
  dict[keys.PrecipMax] = payload.precipMax;
  dict[keys.WindMax] = payload.windMax;
  dict[keys.WeatherFetchTime] = payload.fetchTime;
  dict[keys.WeatherTempHourly] = payload.tempBytes;
  if (payload.feelsTempBytes) {
    dict[keys.WeatherFeelsTempHourly] = payload.feelsTempBytes;
  }
  dict[keys.WeatherPrecipHourly] = payload.precipBytes;
  dict[keys.WeatherWindHourly] = payload.windBytes;
  dict[keys.WeatherIsDayHourly] = payload.isDayBytes;
  if (sendMeta.apiFetchedAt) {
    dict[keys.WeatherApiFetchedAt] = sendMeta.apiFetchedAt;
  }
  if (sendMeta.apiLatE4 !== undefined && sendMeta.apiLatE4 !== null) {
    dict[keys.WeatherApiLatE4] = sendMeta.apiLatE4;
  }
  if (sendMeta.apiLonE4 !== undefined && sendMeta.apiLonE4 !== null) {
    dict[keys.WeatherApiLonE4] = sendMeta.apiLonE4;
  }
  if (sendMeta.statusFlags) {
    dict[keys.WeatherStatusFlags] = sendMeta.statusFlags;
  }

  Pebble.sendAppMessage(
    dict,
    function () {
      console.log('Weather sent to watch (' + payload.count + 'h)');
      wlog('SND+', '');
      if (!sendOptions.keepInFlight) {
        clearWeatherFetchInFlight();
      }
    },
    function (e) {
      console.log('Weather send failed: ' + JSON.stringify(e));
      wlog('SND!', 'appmsg');
      clearWeatherFetchInFlight();
    }
  );
}

function fetchForecast(latitude, longitude, forEpoch, options) {
  options = options || {};
  var hours = getForecastHours();
  var startEpoch = forEpoch ? hourStartEpoch(forEpoch) : null;
  var model = getWeatherProviderModel();

  if (!options.forceRefresh && shouldUseFetchCache(latitude, longitude, model, hours, startEpoch)) {
    var cached = readWeatherFetchCache();
    if (cached && cached.payload) {
      console.log('Weather fetch skipped (recent cache) — resending to watch');
      var ageMs = Date.now() - cacheApiFetchedAt(cached);
      wlog(
        'C+',
        'phone ' +
          weatherDebugLog.formatAgeMs(ageMs) +
          '/' +
          weatherDebugLog.formatAgeMs(getWeatherUpdateIntervalMs()) +
          ' ' +
          cached.payload.count +
          'h'
      );
      sendWeatherPayload(cached.payload, buildSendMeta(latitude, longitude, cached, 0));
      return;
    }
    console.log('Weather fetch cache miss — fetching');
    wlogCacheMiss(latitude, longitude, model, hours, startEpoch);
  } else if (!options.forceRefresh) {
    wlogCacheMiss(latitude, longitude, model, hours, startEpoch);
  } else {
    wlog('API', 'force refresh');
  }

  var statusFlags = cacheHasLocationPending(latitude, longitude, model, hours, startEpoch)
    ? WEATHER_STATUS_LOCATION_PENDING
    : 0;
  if (statusFlags) {
    var staleCache = readWeatherFetchCache();
    if (staleCache && staleCache.payload) {
      sendWeatherPayload(
        staleCache.payload,
        buildSendMeta(latitude, longitude, staleCache, statusFlags),
        { keepInFlight: true }
      );
    }
  }

  var url =
    'https://api.open-meteo.com/v1/forecast?' +
    'latitude=' +
    quantizeCoord(latitude) +
    '&longitude=' +
    quantizeCoord(longitude) +
    '&hourly=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,is_day' +
    '&daily=sunrise,sunset&timezone=auto';

  if (model) {
    url += '&models=' + encodeURIComponent(model);
  }

  if (startEpoch) {
    var endEpoch = startEpoch + hours * 3600;
    url += '&start_date=' + formatDateYYYYMMDD(startEpoch);
    url += '&end_date=' + formatDateYYYYMMDD(endEpoch);
  } else {
    url += '&forecast_hours=' + hours;
  }

  console.log(
    'Weather fetch: provider=' +
      getWeatherProvider() +
      (model ? ' model=' + model : ' model=auto')
  );
  wlog(
    'API',
    quantizeCoord(latitude).toFixed(2) +
      ',' +
      quantizeCoord(longitude).toFixed(2) +
      ' ' +
      (model || 'auto')
  );

  xhrRequest(url, function (responseText) {
    if (!responseText) {
      console.log('Weather fetch failed');
      wlog('API!', 'no response');
      notifyWeatherFetchFailed('api');
      return;
    }
    try {
      var json = JSON.parse(responseText);
      var payload = packWeatherPayload(json, hours, startEpoch);
      if (!payload) {
        console.log('Weather payload empty');
        wlog('API!', 'empty');
        notifyWeatherFetchFailed('empty');
        return;
      }
      var nowMs = Date.now();
      var sunTimes = extractDailySunTimes(json);
      var cacheEntry = {
        key: weatherFetchCacheKey(latitude, longitude, model, hours, startEpoch),
        fetchedAt: nowMs,
        apiFetchedAt: nowMs,
        latQ: quantizeCoord(latitude),
        lonQ: quantizeCoord(longitude),
        fetchTime: payload.fetchTime,
        count: payload.count,
        isDayBytes: payload.isDayBytes,
        utcOffsetSeconds:
          typeof json.utc_offset_seconds === 'number' ? json.utc_offset_seconds : 0,
        payload: payload,
      };
      if (sunTimes) {
        cacheEntry.dailySunrise = sunTimes.sunrise;
        cacheEntry.dailySunset = sunTimes.sunset;
      }
      writeWeatherFetchCache(cacheEntry);
      wlog('API+', model || 'auto');
      resetWeatherRetryBackoff();
      sendWeatherPayload(payload, buildSendMeta(latitude, longitude, cacheEntry, 0));
    } catch (e) {
      console.log('Weather parse error: ' + e);
      wlog('API!', 'parse');
      notifyWeatherFetchFailed('parse');
    }
  });
}

function readGeocodeCache(city) {
  try {
    var raw = localStorage.getItem('geocode:' + city.toLowerCase());
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeGeocodeCache(city, latitude, longitude) {
  try {
    localStorage.setItem(
      'geocode:' + city.toLowerCase(),
      JSON.stringify({ lat: latitude, lon: longitude })
    );
  } catch (e) {
    console.log('Geocode cache write failed');
  }
}

function geocodeCity(city, callback) {
  var cached = readGeocodeCache(city);
  if (cached) {
    wlog('GEO+', city);
    callback({ latitude: cached.lat, longitude: cached.lon });
    return;
  }

  wlog('GEO', city + '→api');

  var url =
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(city) +
    '&count=1&language=en&format=json';
  xhrRequest(url, function (responseText) {
    if (!responseText) {
      wlog('GEO!', city);
      callback(null);
      return;
    }
    try {
      var json = JSON.parse(responseText);
      if (!json.results || json.results.length === 0) {
        wlog('GEO!', city + ' not found');
        callback(null);
        return;
      }
      var result = json.results[0];
      writeGeocodeCache(city, result.latitude, result.longitude);
      callback(result);
    } catch (e) {
      wlog('GEO!', city + ' parse');
      callback(null);
    }
  });
}

function getWeather(forEpoch, options) {
  options = options || {};
  weatherRetryContext = { forEpoch: forEpoch || null, options: options };

  if (!options.forceRefresh && pauseWeatherAtNightEnabled()) {
    var nightCache = readWeatherFetchCache();
    if (nightCache && weatherIsNightNow(nightCache)) {
      console.log('Weather fetch paused at night');
      wlog('NIGHT', 'cache→watch');
      if (nightCache.payload) {
        sendWeatherPayload(nightCache.payload, buildSendMeta(null, null, nightCache, 0));
      }
      return;
    }
  }

  if (weatherFetchInFlight && !weatherFetchIsStale()) {
    wlog('SKIP', 'phone in-flight');
    return;
  }
  if (weatherFetchIsStale()) {
    console.log('Weather fetch stale — retrying');
    wlog('STALE', 'retry');
  }

  weatherFetchInFlight = true;
  weatherFetchStartedAt = Date.now();

  if (getLocationMode(options) === 'manual') {
    var city = getManualLocation(options);
    if (!city) {
      console.log('Manual location empty');
      wlog('GEO!', 'no city');
      notifyWeatherFetchFailed('no city');
      return;
    }
    geocodeCity(city, function (result) {
      if (!result) {
        console.log('Geocode failed');
        notifyWeatherFetchFailed('geocode');
        return;
      }
      fetchForecast(result.latitude, result.longitude, forEpoch, options);
    });
    return;
  }

  /* Reuse our last fix within GpsMaxAge (with near-miss gate). Phone WebViews
     often omit Position.timestamp or stamp "now", so OS maximumAge alone made
     every GPS log line show 0s even when the fix was cached. */
  if (!options.forceRefresh) {
    var lastGps = readLastGpsFix();
    if (lastGps && Date.now() - lastGps.t < gpsCacheExpiryMs()) {
      wlogGpsCacheReuse(lastGps);
      fetchForecast(lastGps.lat, lastGps.lon, forEpoch, options);
      return;
    }
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      wlogGpsPosition(pos);
      fetchForecast(pos.coords.latitude, pos.coords.longitude, forEpoch, options);
    },
    function (err) {
      console.log('Location error: ' + (err && err.message ? err.message : 'unknown'));
      wlog('GPS!', err && err.message ? err.message : 'unknown');
      notifyWeatherFetchFailed('gps');
    },
    { timeout: 15000, maximumAge: options.forceRefresh ? 0 : gpsCacheExpiryMs() }
  );
}

function scheduleWeatherRequest(forEpoch, options) {
  cancelWeatherApiRetryTimer();
  if (weatherRequestTimer) {
    clearTimeout(weatherRequestTimer);
  }
  weatherRequestTimer = setTimeout(function () {
    weatherRequestTimer = null;
    getWeather(forEpoch, options || {});
  }, 500);
}

function getSeenReleaseVersion() {
  try {
    return localStorage.getItem(RELEASE_SEEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

function setSeenReleaseVersion(version) {
  try {
    localStorage.setItem(RELEASE_SEEN_KEY, version);
  } catch (e) {
    console.log('Release seen version write failed');
  }
}

function getReleaseNotificationMode() {
  var mode = String(getClaySetting('ReleaseNotification', RELEASE_NOTIFICATION_NORMAL));
  if (mode !== RELEASE_NOTIFICATION_NORMAL &&
      mode !== RELEASE_NOTIFICATION_ALWAYS &&
      mode !== RELEASE_NOTIFICATION_NEVER) {
    return RELEASE_NOTIFICATION_NORMAL;
  }
  return mode;
}

function showHolidaysEnabled() {
  return claySettingIsTruthy(getClaySetting('ShowHolidays', true));
}

function resolveHolidayCountry() {
  var country = getClaySetting('HolidayCountry', '');
  if (country) {
    return country;
  }
  return holidays.detectLocaleCountryCode();
}

function getHolidayRegion() {
  return getClaySetting('HolidayRegion', '') || '';
}

function sendHolidayMask(mask) {
  var dict = {};
  dict[keys.CalendarHolidayMask] = mask;
  Pebble.sendAppMessage(
    dict,
    function () {
      console.log('Holiday mask sent to watch: ' + mask);
    },
    function (e) {
      console.log('Holiday mask send failed: ' + JSON.stringify(e));
    }
  );
}

function holidayNowFromOptions(options) {
  if (options && options.now instanceof Date && !isNaN(options.now.getTime())) {
    return options.now;
  }
  if (options && typeof options.nowEpoch === 'number' && options.nowEpoch > 1000000000) {
    return new Date(options.nowEpoch * 1000);
  }
  return new Date();
}

function syncHolidaysToWatch(options) {
  options = options || {};

  if (!showHolidaysEnabled()) {
    sendHolidayMask(0);
    return;
  }

  var country = resolveHolidayCountry();
  if (!holidays.isSupportedCountryCode(country)) {
    sendHolidayMask(0);
    return;
  }

  if (holidayFetchInFlight && !options.forceRefresh) {
    return;
  }

  holidayFetchInFlight = true;
  holidays.fetchHolidaysForWindow({
    countryCode: country,
    regionCode: getHolidayRegion(),
    weekStart: String(getClaySetting('WeekStart', '0')),
    now: holidayNowFromOptions(options),
    xhrRequest: xhrRequest,
  }, function (result) {
    holidayFetchInFlight = false;
    sendHolidayMask(result.mask || 0);
  });
}

function scheduleHolidaySync(options) {
  if (holidayRequestTimer) {
    clearTimeout(holidayRequestTimer);
  }
  holidayRequestTimer = setTimeout(function () {
    holidayRequestTimer = null;
    syncHolidaysToWatch(options || {});
  }, 500);
}

function maybeShowReleaseNotice(options) {
  options = options || {};
  if (releaseNoticeShownThisSession && !options.fromWatch) {
    return;
  }

  var mode = getReleaseNotificationMode();

  if (mode === RELEASE_NOTIFICATION_NEVER) {
    setSeenReleaseVersion(release.version);
    return;
  }

  if (!release.message) {
    setSeenReleaseVersion(release.version);
    return;
  }

  if (mode === RELEASE_NOTIFICATION_NORMAL && getSeenReleaseVersion() === release.version) {
    return;
  }

  if (typeof Pebble.showSimpleNotificationOnPebble !== 'function') {
    console.log('Release notice skipped: showSimpleNotificationOnPebble unavailable');
    return;
  }

  try {
    Pebble.showSimpleNotificationOnPebble('Argus updated', release.message);
    console.log('Release notice shown (mode=' + mode + ')');
  } catch (err) {
    console.log('Release notice failed: ' + err);
    return;
  }

  releaseNoticeShownThisSession = true;
  if (mode === RELEASE_NOTIFICATION_NORMAL) {
    setSeenReleaseVersion(release.version);
  }
}

Pebble.addEventListener('ready', function () {
  console.log('Argus PKJS ready');
  // Push saved Clay settings on launch so the watch does not stay on defaults.
  sendStoredSettings(function () {
    wlog('REQ', 'boot');
    scheduleWeatherRequest();
    scheduleHolidaySync({ forceRefresh: true });
  });
  setTimeout(function () {
    maybeShowReleaseNotice();
  }, 1000);
});

Pebble.addEventListener('appmessage', function (e) {
  var payload = e && e.payload ? e.payload : null;
  if (!payload) {
    return;
  }

  if (appMessagePayloadHas(payload, 'CheckReleaseNotice')) {
    maybeShowReleaseNotice({ fromWatch: true });
  }
  if (appMessagePayloadHas(payload, 'WeatherDebugSkip')) {
    wlogWeatherWatchSkip(appMessagePayloadGet(payload, 'WeatherDebugSkip'));
  }
  if (appMessagePayloadHas(payload, 'REQUEST_WEATHER')) {
    var forEpoch = appMessagePayloadGet(payload, 'WeatherForEpoch');
    var weatherOptions = {};
    if (appMessagePayloadHas(payload, 'LocationMode')) {
      weatherOptions.locationMode = appMessagePayloadGet(payload, 'LocationMode');
    }
    if (appMessagePayloadHas(payload, 'ManualLocation')) {
      weatherOptions.manualLocation = appMessagePayloadGet(payload, 'ManualLocation');
    }
    var reqKind = appMessagePayloadGet(payload, 'WeatherRequestKind');
    var reqKindKey = String(reqKind);
    /* Only explicit watch force bypasses phone GPS/API caches; stale may reuse them. */
    if (reqKindKey === '1') {
      weatherOptions.forceRefresh = true;
    }
    var reqDetail = forEpoch ? 't=' + forEpoch : '';
    wlogWeatherRequestKind(reqKind, reqDetail);
    scheduleWeatherRequest(forEpoch || null, weatherOptions);
  }
  if (appMessagePayloadHas(payload, 'REQUEST_HOLIDAYS')) {
    var holidayOptions = { forceRefresh: true };
    var holidayEpoch = Number(appMessagePayloadGet(payload, 'REQUEST_HOLIDAYS'));
    /* Watch sends Unix seconds (simulated via CaptureTimeOffset when capturing). */
    if (holidayEpoch > 1000000000) {
      holidayOptions.nowEpoch = holidayEpoch;
    }
    scheduleHolidaySync(holidayOptions);
  }
});

Pebble.addEventListener('showConfiguration', function () {
  injectClayConfigPanels();
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) {
    return;
  }

  var raw;
  try {
    raw = parseClayWebviewResponse(e.response);
  } catch (err) {
    console.log('Settings response parse failed: ' + err);
    return;
  }

  var prevFlat = getStoredClaySettings() || {};
  var nextFlat = flattenClayRaw(raw);
  var forceWeather = weatherFetchSettingsChanged(prevFlat, nextFlat);

  persistClaySettingsFromRaw(raw);
  stripPkjsOnlyClayKeys(raw);

  sendPreparedSettingsInChunks(
    Clay.prepareSettingsForAppMessage(raw),
    function () {
      console.log('Settings sent to watch');
      if (forceWeather) {
        wlog('REQ', 'settings save');
        getWeather(null, { forceRefresh: true });
      }
      scheduleHolidaySync({ forceRefresh: true });
    },
    function (err) {
      console.log('Settings send failed: ' + JSON.stringify(err));
    }
  );
});
