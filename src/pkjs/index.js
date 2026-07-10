var Clay = require('@rebble/clay');
var clayConfig = require('./config');
var customClay = require('./custom-clay');
var pkg = require('../../package.json');
var keys = require('message_keys');

var clay = new Clay(clayConfig, customClay, {
  autoHandleEvents: false,
  userData: {
    version: pkg.version,
    githubUrl: 'https://github.com/filcuk/pebble-watchface-argus',
  },
});

var DEFAULT_LAT = 51.5074;
var DEFAULT_LON = -0.1278;
var weatherFetchInFlight = false;
var weatherFetchStartedAt = 0;
var weatherRequestTimer = null;
var WEATHER_FETCH_STALE_MS = 30000;

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

function sendStoredSettings(onComplete) {
  var settings = getStoredClaySettings();
  if (!settings) {
    if (onComplete) {
      onComplete();
    }
    return;
  }

  Pebble.sendAppMessage(
    Clay.prepareSettingsForAppMessage(settings),
    function () {
      console.log('Stored settings synced to watch');
      if (onComplete) {
        onComplete();
      }
    },
    function (err) {
      console.log('Stored settings sync failed: ' + JSON.stringify(err));
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

function getLocationMode() {
  return getClaySetting('LocationMode', '0') === '1' ? 'manual' : 'gps';
}

function getManualLocation() {
  return getClaySetting('ManualLocation', '') || '';
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

function fetchForecast(latitude, longitude, forEpoch) {
  var hours = getForecastHours();
  var startEpoch = forEpoch ? hourStartEpoch(forEpoch) : null;
  var url =
    'https://api.open-meteo.com/v1/forecast?' +
    'latitude=' +
    latitude +
    '&longitude=' +
    longitude +
    '&hourly=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,is_day&timezone=auto';

  if (startEpoch) {
    var endEpoch = startEpoch + hours * 3600;
    url += '&start_date=' + formatDateYYYYMMDD(startEpoch);
    url += '&end_date=' + formatDateYYYYMMDD(endEpoch);
  } else {
    url += '&forecast_hours=' + hours;
  }

  xhrRequest(url, function (responseText) {
    if (!responseText) {
      console.log('Weather fetch failed');
      clearWeatherFetchInFlight();
      return;
    }
    try {
      var json = JSON.parse(responseText);
      var payload = packWeatherPayload(json, hours, startEpoch);
      sendWeatherPayload(payload);
    } catch (e) {
      console.log('Weather parse error: ' + e);
      clearWeatherFetchInFlight();
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

function getWeather(forEpoch) {
  if (weatherFetchInFlight && !weatherFetchIsStale()) {
    return;
  }
  if (weatherFetchIsStale()) {
    console.log('Weather fetch stale — retrying');
  }

  weatherFetchInFlight = true;
  weatherFetchStartedAt = Date.now();

  if (getLocationMode() === 'manual') {
    var city = getManualLocation();
    if (!city) {
      console.log('Manual location empty, using default');
      fetchForecast(DEFAULT_LAT, DEFAULT_LON, forEpoch);
      return;
    }
    geocodeCity(city, function (result) {
      if (!result) {
        console.log('Geocode failed, using default');
        fetchForecast(DEFAULT_LAT, DEFAULT_LON, forEpoch);
        return;
      }
      fetchForecast(result.latitude, result.longitude, forEpoch);
    });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      fetchForecast(pos.coords.latitude, pos.coords.longitude, forEpoch);
    },
    function (err) {
      console.log('Location error: ' + (err && err.message ? err.message : 'unknown'));
      fetchForecast(DEFAULT_LAT, DEFAULT_LON, forEpoch);
    },
    { timeout: 15000, maximumAge: 60000 }
  );
}

function scheduleWeatherRequest(forEpoch) {
  if (weatherRequestTimer) {
    clearTimeout(weatherRequestTimer);
  }
  weatherRequestTimer = setTimeout(function () {
    weatherRequestTimer = null;
    getWeather(forEpoch);
  }, 500);
}

Pebble.addEventListener('ready', function () {
  console.log('Argus PKJS ready');
  // Push saved Clay settings on launch so the watch does not stay on defaults.
  sendStoredSettings(function () {
    // Fallback fetch when the watch requested weather before PKJS finished loading.
    scheduleWeatherRequest();
  });
});

Pebble.addEventListener('appmessage', function (e) {
  if (e.payload && e.payload[keys.REQUEST_WEATHER]) {
    var forEpoch = e.payload[keys.WeatherForEpoch];
    scheduleWeatherRequest(forEpoch || null);
  }
});

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e || !e.response) {
    return;
  }

  Pebble.sendAppMessage(
    clay.getSettings(e.response),
    function () {
      console.log('Settings sent to watch');
      getWeather();
    },
    function (err) {
      console.log('Settings send failed: ' + JSON.stringify(err));
    }
  );
});
