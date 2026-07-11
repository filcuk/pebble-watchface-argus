var Clay = require('@rebble/clay');
var clayConfig = require('./config');
var customClay = require('./custom-clay');
var pkg = require('../../package.json');
var release = require('./release');
var keys = require('message_keys');

var clay = new Clay(clayConfig, customClay, {
  autoHandleEvents: false,
  userData: {
    version: pkg.version,
    githubUrl: 'https://github.com/filcuk/pebble-watchface-argus',
  },
});

var weatherFetchInFlight = false;
var weatherFetchStartedAt = 0;
var weatherRequestTimer = null;
var WEATHER_FETCH_STALE_MS = 30000;
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

function sendPreparedSettingsInChunks(prepared, onComplete, onError) {
  var intKeys = [];
  var stringKeys = [];
  var key;

  for (key in prepared) {
    if (!Object.prototype.hasOwnProperty.call(prepared, key)) {
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
  var minutes = parseInt(getClaySetting('WeatherUpdateInterval', '30'), 10);
  if (minutes !== 5 && minutes !== 15 && minutes !== 30 && minutes !== 60) {
    minutes = 30;
  }
  return minutes * 60 * 1000;
}

function getGpsMaxAgeMs() {
  var value = String(getClaySetting('GpsMaxAge', '30'));
  return GPS_MAX_AGE_MS[value] || GPS_MAX_AGE_MS['30'];
}

function claySettingIsTruthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function pauseWeatherAtNightEnabled() {
  return claySettingIsTruthy(getClaySetting('PauseWeatherAtNight', false));
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
    latitude.toFixed(4) +
    ',' +
    longitude.toFixed(4) +
    ',' +
    (model || 'auto') +
    ',' +
    hours +
    ',' +
    (startEpoch || 0)
  );
}

function shouldUseFetchCache(latitude, longitude, model, hours, startEpoch) {
  var cache = readWeatherFetchCache();
  if (!cache) {
    return false;
  }
  if (cache.key !== weatherFetchCacheKey(latitude, longitude, model, hours, startEpoch)) {
    return false;
  }
  return Date.now() - cache.fetchedAt < getWeatherUpdateIntervalMs();
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

function parseOpenMeteoTime(iso) {
  if (!iso) {
    return Math.floor(Date.now() / 1000);
  }
  var parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!parts) {
    return Math.floor(Date.now() / 1000);
  }
  var date = new Date(
    parseInt(parts[1], 10),
    parseInt(parts[2], 10) - 1,
    parseInt(parts[3], 10),
    parseInt(parts[4], 10),
    parseInt(parts[5], 10)
  );
  return Math.floor(date.getTime() / 1000);
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

function packWeatherPayload(json, hours, startEpoch) {
  var times = json.hourly.time || [];
  var temps = json.hourly.temperature_2m;
  var feelsTemps = json.hourly.apparent_temperature || [];
  var precips = json.hourly.precipitation;
  var winds = json.hourly.wind_speed_10m || [];
  var isDay = json.hourly.is_day || [];

  var startIndex = 0;
  if (startEpoch) {
    for (var i = 0; i < times.length; i++) {
      if (parseOpenMeteoTime(times[i]) >= startEpoch) {
        startIndex = i;
        break;
      }
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
    fetchTime: parseOpenMeteoTime(times[startIndex]),
  };
}

function notifyWeatherFetchFailed() {
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
}

function sendWeatherPayload(payload) {
  if (!payload) {
    clearWeatherFetchInFlight();
    return;
  }

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

  Pebble.sendAppMessage(
    dict,
    function () {
      console.log('Weather sent to watch (' + payload.count + 'h)');
      clearWeatherFetchInFlight();
    },
    function (e) {
      console.log('Weather send failed: ' + JSON.stringify(e));
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
    console.log('Weather fetch skipped (recent cache)');
    clearWeatherFetchInFlight();
    return;
  }

  var url =
    'https://api.open-meteo.com/v1/forecast?' +
    'latitude=' +
    latitude +
    '&longitude=' +
    longitude +
    '&hourly=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,is_day&timezone=auto';

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

  xhrRequest(url, function (responseText) {
    if (!responseText) {
      console.log('Weather fetch failed');
      notifyWeatherFetchFailed();
      return;
    }
    try {
      var json = JSON.parse(responseText);
      var payload = packWeatherPayload(json, hours, startEpoch);
      if (!payload) {
        console.log('Weather payload empty');
        notifyWeatherFetchFailed();
        return;
      }
      writeWeatherFetchCache({
        key: weatherFetchCacheKey(latitude, longitude, model, hours, startEpoch),
        fetchedAt: Date.now(),
        fetchTime: payload.fetchTime,
        count: payload.count,
        isDayBytes: payload.isDayBytes,
      });
      sendWeatherPayload(payload);
    } catch (e) {
      console.log('Weather parse error: ' + e);
      notifyWeatherFetchFailed();
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
    callback({ latitude: cached.lat, longitude: cached.lon });
    return;
  }

  var url =
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(city) +
    '&count=1&language=en&format=json';
  xhrRequest(url, function (responseText) {
    if (!responseText) {
      callback(null);
      return;
    }
    try {
      var json = JSON.parse(responseText);
      if (!json.results || json.results.length === 0) {
        callback(null);
        return;
      }
      var result = json.results[0];
      writeGeocodeCache(city, result.latitude, result.longitude);
      callback(result);
    } catch (e) {
      callback(null);
    }
  });
}

function getWeather(forEpoch, options) {
  options = options || {};

  if (!options.forceRefresh && pauseWeatherAtNightEnabled()) {
    var nightCache = readWeatherFetchCache();
    if (nightCache && weatherIsNightNow(nightCache)) {
      console.log('Weather fetch paused at night');
      return;
    }
  }

  if (weatherFetchInFlight && !weatherFetchIsStale()) {
    return;
  }
  if (weatherFetchIsStale()) {
    console.log('Weather fetch stale — retrying');
  }

  weatherFetchInFlight = true;
  weatherFetchStartedAt = Date.now();

  if (getLocationMode(options) === 'manual') {
    var city = getManualLocation(options);
    if (!city) {
      console.log('Manual location empty');
      notifyWeatherFetchFailed();
      return;
    }
    geocodeCity(city, function (result) {
      if (!result) {
        console.log('Geocode failed');
        notifyWeatherFetchFailed();
        return;
      }
      fetchForecast(result.latitude, result.longitude, forEpoch, options);
    });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      fetchForecast(pos.coords.latitude, pos.coords.longitude, forEpoch, options);
    },
    function (err) {
      console.log('Location error: ' + (err && err.message ? err.message : 'unknown'));
      notifyWeatherFetchFailed();
    },
    { timeout: 15000, maximumAge: getGpsMaxAgeMs() }
  );
}

function scheduleWeatherRequest(forEpoch, options) {
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
    // Fallback fetch when the watch requested weather before PKJS finished loading.
    scheduleWeatherRequest();
  });
  setTimeout(function () {
    maybeShowReleaseNotice();
  }, 1000);
});

Pebble.addEventListener('appmessage', function (e) {
  if (e.payload && e.payload[keys.CheckReleaseNotice]) {
    maybeShowReleaseNotice({ fromWatch: true });
  }
  if (e.payload && e.payload[keys.REQUEST_WEATHER]) {
    var forEpoch = e.payload[keys.WeatherForEpoch];
    var weatherOptions = {};
    if (e.payload[keys.LocationMode] !== undefined && e.payload[keys.LocationMode] !== null) {
      weatherOptions.locationMode = e.payload[keys.LocationMode];
    }
    if (e.payload[keys.ManualLocation]) {
      weatherOptions.manualLocation = e.payload[keys.ManualLocation];
    }
    scheduleWeatherRequest(forEpoch || null, weatherOptions);
  }
});

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) {
    return;
  }

  sendPreparedSettingsInChunks(
    clay.getSettings(e.response),
    function () {
      console.log('Settings sent to watch');
      getWeather(null, { forceRefresh: true });
    },
    function (err) {
      console.log('Settings send failed: ' + JSON.stringify(err));
    }
  );
});
