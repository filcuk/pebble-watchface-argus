var holidaySubdivisions = require('./holiday-subdivisions');

function encodeHolidaySubdivisions(map) {
  var parts = [];
  var countryCode;

  for (countryCode in map) {
    if (!Object.prototype.hasOwnProperty.call(map, countryCode)) {
      continue;
    }
    var regions = map[countryCode].map(function (entry) {
      return entry.code + '\x1f' + entry.name;
    }).join('\x1e');
    parts.push(countryCode + ':' + regions);
  }

  return parts.join('\x1d');
}

var precipitationInfoHtml =
  '<div class="argus-precip-info">' +
  '<div class="argus-setting-label">Precipitation</div>' +
  '<p class="argus-precip-intro">' +
  'Blue bars representing precipitation on the weather chart use a fixed intensity scale. The chart height is split ' +
  'into five equal bands. Within each band, bar height shows how far the hourly rate falls ' +
  'within that range.' +
  '</p>' +
  '<div class="argus-precip-table-wrap">' +
  '<table class="argus-precip-table">' +
  '<thead><tr><th>Intensity</th><th>Rate (mm/h)</th><th>Chart position</th></tr></thead>' +
  '<tbody>' +
  '<tr><td>Trace</td><td>< 0.25</td><td>Bottom 1/5</td></tr>' +
  '<tr><td>Very light</td><td>0.25 – 1</td><td>2nd 1/5</td></tr>' +
  '<tr><td>Light</td><td>1 – 2.5</td><td>3rd 1/5</td></tr>' +
  '<tr><td>Moderate</td><td>2.5 – 10</td><td>4th 1/5</td></tr>' +
  '<tr><td>Heavy</td><td>10 – 25+</td><td>Top 1/5</td></tr>' +
  '</tbody>' +
  '</table>' +
  '</div>' +
  '</div>';

var windInfoHtml =
  '<div class="argus-wind-info">' +
  '<div class="argus-setting-label">Wind</div>' +
  '<p class="argus-precip-intro">' +
  'Gray × marks show wind speed on the Beaufort scale. Within each force level, ' +
  'mark height reflects where the hourly speed falls in that level\'s range. ' +
  'The chart axis normally spans force 0 to 8. If any visible hour exceeds force 8 ' +
  '(75&nbsp;km/h or more), the axis extends to force 12.' +
  '</p>' +
  '<div class="argus-precip-table-wrap">' +
  '<table class="argus-precip-table">' +
  '<thead><tr><th>Force</th><th>Name</th><th>Speed (km/h)</th></tr></thead>' +
  '<tbody>' +
  '<tr><td>0</td><td>Calm</td><td>&lt; 1</td></tr>' +
  '<tr><td>1</td><td>Light air</td><td>1 – 5</td></tr>' +
  '<tr><td>2</td><td>Light breeze</td><td>6 – 11</td></tr>' +
  '<tr><td>3</td><td>Gentle breeze</td><td>12 – 19</td></tr>' +
  '<tr><td>4</td><td>Moderate breeze</td><td>20 – 28</td></tr>' +
  '<tr><td>5</td><td>Fresh breeze</td><td>29 – 38</td></tr>' +
  '<tr><td>6</td><td>Strong breeze</td><td>39 – 49</td></tr>' +
  '<tr><td>7</td><td>Moderate gale</td><td>50 – 61</td></tr>' +
  '<tr><td>8</td><td>Gale</td><td>62 – 74</td></tr>' +
  '<tr><td>9</td><td>Strong gale</td><td>75 – 88</td></tr>' +
  '<tr><td>10</td><td>Storm</td><td>89 – 102</td></tr>' +
  '<tr><td>11</td><td>Violent storm</td><td>103 – 117</td></tr>' +
  '<tr><td>12</td><td>Hurricane force</td><td>118+</td></tr>' +
  '</tbody>' +
  '</table>' +
  '</div>' +
  '<p class="argus-wind-note">' +
  'Forces 9–12 only appear when the axis extends. Marks above force 8 are drawn in ' +
  '<em>yellow</em>.' +
  '</p>' +
  '</div>';

var headerDisplayHelpHtml =
  '<strong>Step count</strong> shows your total steps for the day. <strong>Temperature</strong> shows the current ' +
  'reading with today\'s minimum and maximum forecasted. <strong>Heart rate</strong> ' +
  'shows your current BPM with today\'s maximum.<br><br>' +
  '<em>Maximum heart rate is recorded while Argus is active. When you open the watchface, ' +
  'earlier peaks from today may be included if the watch already stored minute ' +
  'heart-rate samples.</em>';

module.exports = [
  {
    type: 'radiogroup',
    messageKey: 'HourFormat',
    label: 'Time format',
    group: 'tabTime',
    defaultValue: '0',
    options: [
      { label: 'Auto', value: '0' },
      { label: '12h', value: '1' },
      { label: '24h', value: '2' },
    ],
  },
  {
    type: 'radiogroup',
    messageKey: 'RealtimeSteps',
    label: 'Biometric updates',
    description: 'How often biometrics updates are retrieved. Optimised leaves updates to the OS, live updates on every change. This setting affects battery life.',
    group: 'tabTime',
    defaultValue: '0',
    capabilities: ['HEALTH'],
    options: [
      { label: 'Optimised', value: '0' },
      { label: 'Every minute', value: '1' },
      { label: 'Live', value: '2' },
    ],
  },
  {
    type: 'radiogroup',
    messageKey: 'WeekStart',
    label: 'Week start',
    group: 'tabCalendar',
    defaultValue: '0',
    options: [
      { label: 'Monday', value: '0' },
      { label: 'Sunday', value: '1' },
    ],
  },
  {
    type: 'radiogroup',
    messageKey: 'WeekNumberMode',
    label: 'Week numbers',
    description:
      'Type of calendar. This setting affects week numbers.<br><br>' +
      '<strong>ISO 8601</strong> is the international standard. Week 1 is determined by the first Thursday ' +
      'of the year. <strong>US</strong> traditional style is typically used in North America. US week 1 is ' +
      'the week containing 1st of January.',
    group: 'tabCalendar',
    defaultValue: '0',
    options: [
      { label: 'ISO', value: '0' },
      { label: 'US', value: '1' },
    ],
  },
  {
    type: 'toggle',
    messageKey: 'ShowHolidays',
    label: 'Show holidays',
    description: 'Mark public holidays on the calendar with a blue outline.',
    group: 'tabCalendar',
    defaultValue: true,
  },
  {
    type: 'input',
    messageKey: 'HolidayCountry',
    label: 'Holiday country',
    description: 'Public holidays for this country are shown on the calendar.',
    group: 'tabCalendar',
    defaultValue: '',
    attributes: {
      placeholder: 'Select country',
    },
  },
  {
    type: 'radiogroup',
    messageKey: 'HolidayRegion',
    label: 'Region',
    description: 'Optional region for regional public holidays. National only shows nationwide holidays.',
    group: 'tabCalendar',
    defaultValue: '',
    options: [{ label: 'National only', value: '' }],
  },
  {
    type: 'text',
    id: 'argus-holiday-subdivisions-data',
    group: 'tabCalendar',
    defaultValue: encodeHolidaySubdivisions(holidaySubdivisions),
  },
  {
    type: 'radiogroup',
    messageKey: 'HeaderDisplay',
    label: 'Header',
    description: 'Choose what appears in the center of the top status bar.',
    group: 'tabDisplay',
    defaultValue: '0',
    options: [
      { label: 'Full date', value: '0' },
      { label: 'Step count', value: '1' },
      { label: 'Heart rate', value: '3' },
      { label: 'Temperature', value: '2' },
    ],
  },
  {
    type: 'text',
    id: 'argus-header-display-help',
    group: 'tabDisplay',
    defaultValue: headerDisplayHelpHtml,
  },
  {
    type: 'radiogroup',
    messageKey: 'ClockFont',
    label: 'Clock font',
    description: 'Select the typeface used for the large time digits.',
    group: 'tabDisplay',
    defaultValue: '0',
    options: [
      { label: 'LECO', value: '0' },
      { label: 'Roboto', value: '1' },
      { label: 'Bitham Bold', value: '2' },
      { label: 'Bitham Medium', value: '3' },
    ],
  },
  {
    type: 'radiogroup',
    messageKey: 'BluetoothDisplay',
    label: 'Bluetooth icon',
    description: 'Bluetooth status icon visibility.',
    group: 'tabDisplay',
    defaultValue: '1',
    options: [
      { label: 'Always', value: '0' },
      { label: 'Disconnected', value: '1' },
    ],
  },
  {
    type: 'radiogroup',
    messageKey: 'TemperatureUnit',
    label: 'Temperature scale',
    group: 'tabWeather',
    defaultValue: '0',
    options: [
      { label: '°C', value: '0' },
      { label: '°F', value: '1' },
    ],
  },
  {
    type: 'radiogroup',
    messageKey: 'ForecastHours',
    label: 'Forecast',
    description: 'How many hours of weather data to show on the watchface.',
    group: 'tabWeather',
    defaultValue: '24',
    options: [
      { label: '12h', value: '12' },
      { label: '24h', value: '24' },
      { label: '48h', value: '48' },
    ],
  },
  {
    type: 'toggle',
    messageKey: 'TemperatureDisplay',
    label: 'Feels-like temperature',
    description: 'Show feels-like temperature, instead of actual temperature.',
    group: 'tabWeather',
    defaultValue: false,
  },
  {
    type: 'radiogroup',
    messageKey: 'LocationMode',
    label: 'Location',
    group: 'tabWeather',
    defaultValue: '0',
    options: [
      { label: 'Auto', value: '0' },
      { label: 'Manual', value: '1' },
    ],
  },
  {
    type: 'input',
    messageKey: 'ManualLocation',
    label: 'City name',
    group: 'tabWeather',
    defaultValue: '',
    attributes: {
      placeholder: 'e.g. London',
      limit: 48,
    },
  },
  {
    type: 'radiogroup',
    messageKey: 'GpsMaxAge',
    label: 'GPS update frequency',
    description: 'How long a GPS fix is reused. This setting affects battery life.',
    group: 'tabWeather',
    defaultValue: '30',
    options: [
      { label: '15 minutes', value: '15' },
      { label: '30 minutes', value: '30' },
      { label: '1 hour', value: '60' },
      { label: '2 hours', value: '120' },
      { label: '6 hours', value: '360' },
    ],
  },
  {
    type: 'radiogroup',
    messageKey: 'WeatherProvider',
    label: 'Weather model',
    description:
      'Open-Meteo forecast source. Auto picks the best model for your location.<br><br>' +
      '<em>All models are served by Open-Meteo. Auto combines the highest-' +
      'resolution model available for your coordinates.</em>',
    group: 'tabWeather',
    defaultValue: '0',
    options: [
      { label: 'Auto', value: '0' },
      { label: 'ECMWF (Europe)', value: '1' },
      { label: 'NOAA / GFS (USA)', value: '2' },
      { label: 'DWD / ICON (Germany)', value: '3' },
      { label: 'Météo-France (France)', value: '4' },
      { label: 'JMA (Japan & Korea)', value: '5' },
      { label: 'GEM (Canada)', value: '6' },
      { label: 'UK Met Office (UK)', value: '7' },
    ],
  },
  {
    type: 'toggle',
    messageKey: 'PauseWeatherAtNight',
    label: 'Pause at night',
    description: 'Stop weather updates during night hours.',
    group: 'tabWeather',
    defaultValue: false,
  },
  {
    type: 'radiogroup',
    messageKey: 'WeatherUpdateInterval',
    label: 'Update interval',
    description:
      'How often the watch requests fresh weather data from the phone. ' +
      'Shorter intervals keep data fresher but use more phone and watch battery.',
    group: 'tabWeather',
    defaultValue: '30',
    options: [
      { label: '5 minutes', value: '5' },
      { label: '15 minutes', value: '15' },
      { label: '30 minutes', value: '30' },
      { label: '1 hour', value: '60' },
    ],
  },
  {
    type: 'text',
    id: 'argus-precipitation-info',
    group: 'tabWeatherHelp',
    defaultValue: precipitationInfoHtml,
  },
  {
    type: 'text',
    id: 'argus-wind-info',
    group: 'tabWeatherHelp',
    defaultValue: windInfoHtml,
  },
  {
    type: 'toggle',
    messageKey: 'DebugMode',
    label: 'Debug mode',
    description: 'Enables developer options below for testing without real data.',
    group: 'tabDebug',
    defaultValue: false,
  },
  {
    type: 'toggle',
    messageKey: 'DemoWeather',
    label: 'Demo weather',
    description: 'Shows sample weather data instead of fetching from the network.',
    group: 'tabDebug',
    defaultValue: false,
  },
  {
    type: 'toggle',
    messageKey: 'DemoBiometrics',
    label: 'Demo biometrics',
    description: 'Shows sample step count and heart rate instead of live health data.',
    group: 'tabDebug',
    defaultValue: false,
    capabilities: ['HEALTH'],
  },
  {
    type: 'radiogroup',
    messageKey: 'ReleaseNotification',
    label: 'Release notification',
    description: 'Controls when the update message appears after installing the watchface.',
    group: 'tabDebug',
    defaultValue: '0',
    options: [
      { label: 'Normal', value: '0' },
      { label: 'Always', value: '1' },
      { label: 'Never', value: '2' },
    ],
  },
  {
    type: 'text',
    id: 'argus-footer',
    defaultValue: '',
  },
  {
    type: 'submit',
    defaultValue: 'Save',
  },
];
