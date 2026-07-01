var Clay = require('@rebble/clay');
var clayConfig = require('./config');

var clay = new Clay(clayConfig);

function xhrRequest(url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.onerror = function () {
    callback(null);
  };
  xhr.open(type, url);
  xhr.send();
}

function getForecastHours() {
  var stored = localStorage.getItem('ForecastHours');
  var hours = stored ? parseInt(stored, 10) : 24;
  if (hours !== 24 && hours !== 48 && hours !== 72) {
    hours = 24;
  }
  return hours;
}

function getLocationMode() {
  var stored = localStorage.getItem('LocationMode');
  return stored === '1' ? 'manual' : 'gps';
}

function getManualLocation() {
  return localStorage.getItem('ManualLocation') || '';
}

function packWeatherPayload(json, hours) {
  var temps = json.hourly.temperature_2m;
  var precips = json.hourly.precipitation;
  var count = Math.min(hours, temps.length, precips.length);

  var tempMin = 127;
  var tempMax = -128;
  var precipMax = 0;
  var tempBytes = [];
  var precipBytes = [];

  for (var i = 0; i < count; i++) {
    var temp = Math.round(temps[i]);
    var precip = Math.round(precips[i] * 10);
    if (precip > 255) {
      precip = 255;
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
    tempBytes.push(temp & 0xff);
    precipBytes.push(precip);
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

  return {
    WeatherHourCount: count,
    TempMin: tempMin,
    TempMax: tempMax,
    PrecipMax: precipMax,
    WeatherTempHourly: tempBytes,
    WeatherPrecipHourly: precipBytes,
    WeatherFetchTime: Math.floor(Date.now() / 1000),
  };
}

function sendWeatherPayload(payload) {
  if (!payload) {
    return;
  }
  Pebble.sendAppMessage(payload);
}

function fetchForecast(latitude, longitude) {
  var hours = getForecastHours();
  var forecastDays = Math.ceil(hours / 24);
  var url =
    'https://api.open-meteo.com/v1/forecast?' +
    'latitude=' +
    latitude +
    '&longitude=' +
    longitude +
    '&hourly=temperature_2m,precipitation&forecast_days=' +
    forecastDays;

  xhrRequest(url, 'GET', function (responseText) {
    if (!responseText) {
      return;
    }
    var json = JSON.parse(responseText);
    var payload = packWeatherPayload(json, hours);
    sendWeatherPayload(payload);
  });
}

function geocodeCity(city, callback) {
  var url =
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(city) +
    '&count=1&language=en&format=json';
  xhrRequest(url, 'GET', function (responseText) {
    if (!responseText) {
      callback(null);
      return;
    }
    var json = JSON.parse(responseText);
    if (!json.results || json.results.length === 0) {
      callback(null);
      return;
    }
    callback(json.results[0]);
  });
}

function getWeather() {
  if (getLocationMode() === 'manual') {
    var city = getManualLocation();
    if (!city) {
      return;
    }
    geocodeCity(city, function (result) {
      if (!result) {
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
    function () {
      console.log('Location error');
    },
    { timeout: 15000, maximumAge: 60000 }
  );
}

Pebble.addEventListener('ready', function () {
  getWeather();
});

Pebble.addEventListener('appmessage', function (e) {
  if (e.payload.REQUEST_WEATHER) {
    getWeather();
  }
});

Pebble.addEventListener('webviewclosed', function () {
  getWeather();
});
