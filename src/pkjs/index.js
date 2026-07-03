var Clay = require('@rebble/clay');
var clayConfig = require('./config');
var keys = require('message_keys');

var clay = new Clay(clayConfig, null, { autoHandleEvents: false });

var DEFAULT_LAT = 51.5074;
var DEFAULT_LON = -0.1278;

function getClaySetting(key, defaultValue) {
  try {
    var raw = localStorage.getItem('clay-settings');
    if (!raw) {
      return defaultValue;
    }
    var settings = JSON.parse(raw);
    if (settings[key] === undefined || settings[key] === null) {
      return defaultValue;
    }
    var value = settings[key];
    if (value && typeof value === 'object' && 'value' in value) {
      value = value.value;
    }
    return value;
  } catch (e) {
    return defaultValue;
  }
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

function packWeatherPayload(json, hours) {
  var times = json.hourly.time || [];
  var temps = json.hourly.temperature_2m;
  var precips = json.hourly.precipitation;
  var winds = json.hourly.wind_speed_10m || [];
  var isDay = json.hourly.is_day || [];
  var count = Math.min(hours, temps.length, precips.length);
  if (winds.length > 0) {
    count = Math.min(count, winds.length);
  }

  var tempMin = 127;
  var tempMax = -128;
  var precipMax = 0;
  var windMax = 0;

  for (var i = 0; i < count; i++) {
    var temp = Math.round(temps[i]);
    var precip = Math.round(precips[i] * 10);
    var wind = Math.round(winds[i] || 0);
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
    precipMax: precipMax,
    windMax: windMax,
    tempBytes: packInt8Array(temps, count),
    precipBytes: packUint8Array(
      precips.map(function (p) {
        return Math.round(p * 10);
      }),
      count
    ),
    windBytes: packUint8Array(winds, count),
    isDayBytes: packUint8Array(isDay, count),
    fetchTime: parseOpenMeteoTime(times[0]),
  };
}

function sendWeatherPayload(payload) {
  if (!payload) {
    return;
  }

  var dict = {};
  dict[keys.WeatherHourCount] = payload.count;
  dict[keys.TempMin] = payload.tempMin;
  dict[keys.TempMax] = payload.tempMax;
  dict[keys.PrecipMax] = payload.precipMax;
  dict[keys.WindMax] = payload.windMax;
  dict[keys.WeatherFetchTime] = payload.fetchTime;
  dict[keys.WeatherTempHourly] = payload.tempBytes;
  dict[keys.WeatherPrecipHourly] = payload.precipBytes;
  dict[keys.WeatherWindHourly] = payload.windBytes;
  dict[keys.WeatherIsDayHourly] = payload.isDayBytes;

  Pebble.sendAppMessage(
    dict,
    function () {
      console.log('Weather sent to watch (' + payload.count + 'h)');
    },
    function (e) {
      console.log('Weather send failed: ' + JSON.stringify(e));
    }
  );
}

function fetchForecast(latitude, longitude) {
  var hours = getForecastHours();
  var url =
    'https://api.open-meteo.com/v1/forecast?' +
    'latitude=' +
    latitude +
    '&longitude=' +
    longitude +
    '&hourly=temperature_2m,precipitation,wind_speed_10m,is_day&forecast_hours=' +
    hours +
    '&timezone=auto';

  xhrRequest(url, function (responseText) {
    if (!responseText) {
      console.log('Weather fetch failed');
      return;
    }
    try {
      var json = JSON.parse(responseText);
      var payload = packWeatherPayload(json, hours);
      sendWeatherPayload(payload);
    } catch (e) {
      console.log('Weather parse error: ' + e);
    }
  });
}

function geocodeCity(city, callback) {
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
      callback(json.results[0]);
    } catch (e) {
      callback(null);
    }
  });
}

function getWeather() {
  if (getLocationMode() === 'manual') {
    var city = getManualLocation();
    if (!city) {
      console.log('Manual location empty, using default');
      fetchForecast(DEFAULT_LAT, DEFAULT_LON);
      return;
    }
    geocodeCity(city, function (result) {
      if (!result) {
        console.log('Geocode failed, using default');
        fetchForecast(DEFAULT_LAT, DEFAULT_LON);
        return;
      }
      fetchForecast(result.latitude, result.longitude);
    });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      fetchForecast(pos.coords.latitude, pos.coords.longitude);
    },
    function (err) {
      console.log('Location error: ' + (err && err.message ? err.message : 'unknown'));
      fetchForecast(DEFAULT_LAT, DEFAULT_LON);
    },
    { timeout: 15000, maximumAge: 60000 }
  );
}

Pebble.addEventListener('ready', function () {
  console.log('Argus PKJS ready');
  getWeather();
});

Pebble.addEventListener('appmessage', function (e) {
  if (e.payload && e.payload[keys.REQUEST_WEATHER]) {
    getWeather();
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
