module.exports = [
  {
    type: 'heading',
    defaultValue: 'Argus Settings',
  },
  {
    type: 'text',
    defaultValue: 'Customize layout, calendar, and weather preferences.',
  },
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Time & Calendar',
      },
      {
        type: 'select',
        messageKey: 'HourFormat',
        label: 'Time Format',
        defaultValue: '0',
        options: [
          { label: 'System default', value: '0' },
          { label: '12-hour', value: '1' },
          { label: '24-hour', value: '2' },
        ],
      },
      {
        type: 'select',
        messageKey: 'WeekStart',
        label: 'Week Starts On',
        defaultValue: '0',
        options: [
          { label: 'Monday', value: '0' },
          { label: 'Sunday', value: '1' },
        ],
      },
      {
        type: 'select',
        messageKey: 'WeekNumberMode',
        label: 'Week Number',
        defaultValue: '0',
        options: [
          { label: 'ISO', value: '0' },
          { label: 'Gregorian', value: '1' },
        ],
      },
      {
        type: 'select',
        messageKey: 'BluetoothDisplay',
        label: 'Bluetooth Icon',
        defaultValue: '1',
        options: [
          { label: 'Always visible', value: '0' },
          { label: 'Only when disconnected', value: '1' },
        ],
      },
      {
        type: 'select',
        messageKey: 'HeaderDisplay',
        label: 'Top Center',
        defaultValue: '0',
        options: [
          { label: 'Full date', value: '0' },
          { label: 'Step count', value: '1' },
          { label: 'Min/max temp', value: '2' },
        ],
      },
    ],
  },
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Weather',
      },
      {
        type: 'select',
        messageKey: 'LocationMode',
        label: 'Location',
        defaultValue: '0',
        options: [
          { label: 'GPS', value: '0' },
          { label: 'Manual city', value: '1' },
        ],
      },
      {
        type: 'input',
        messageKey: 'ManualLocation',
        label: 'City Name',
        defaultValue: '',
        attributes: {
          placeholder: 'e.g. London',
          limit: 48,
        },
      },
      {
        type: 'select',
        messageKey: 'ForecastHours',
        label: 'Forecast Length',
        defaultValue: '24',
        options: [
          { label: '12 hours', value: '12' },
          { label: '24 hours', value: '24' },
          { label: '48 hours', value: '48' },
        ],
      },
      {
        type: 'toggle',
        messageKey: 'TemperatureUnit',
        label: 'Use Fahrenheit',
        defaultValue: false,
      },
    ],
  },
  {
    type: 'section',
    items: [
      {
        type: 'heading',
        defaultValue: 'Debug',
      },
      {
        type: 'toggle',
        messageKey: 'DebugMode',
        label: 'Debug mode',
        defaultValue: false,
      },
      {
        type: 'toggle',
        messageKey: 'DemoWeather',
        label: 'Demo weather',
        defaultValue: false,
      },
    ],
  },
  {
    type: 'submit',
    defaultValue: 'Save Settings',
  },
];
