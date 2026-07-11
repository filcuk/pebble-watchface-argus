module.exports = function () {
  var clayConfig = this;

  var TAB_GROUPS = ['tabTime', 'tabDisplay', 'tabWeather', 'tabDebug'];
  var SEGMENT_KEYS = [
    'HourFormat',
    'WeekStart',
    'WeekNumberMode',
    'BluetoothDisplay',
    'LocationMode',
    'ForecastHours',
    'TemperatureUnit',
  ];
  var LIST_RADIO_KEYS = [
    'HeaderDisplay',
    'ClockFont',
    'RealtimeSteps',
    'WeatherProvider',
    'GpsMaxAge',
    'WeatherUpdateInterval',
  ];
  var TITLE_INLINE_SEGMENT_KEYS = [
    'HourFormat',
    'WeekStart',
    'LocationMode',
    'TemperatureUnit',
  ];
  var INLINE_CONTROL_KEYS = SEGMENT_KEYS.filter(function (key) {
    return TITLE_INLINE_SEGMENT_KEYS.indexOf(key) === -1;
  }).concat([
    'TemperatureDisplay',
    'PauseWeatherAtNight',
    'DebugMode',
    'DemoWeather',
    'DemoBiometrics',
  ]);

  var THEME_CSS = [
    '.hide { display: none !important; }',
    'html.argus-settings { color-scheme: dark; }',
    'html.argus-settings,',
    'html.argus-settings body {',
    '  background: #1a1d21 !important;',
    '  color: #e8ebef !important;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
    '  font-size: 16px;',
    '  line-height: 1.4;',
    '  -webkit-font-smoothing: antialiased;',
    '}',
    'html.argus-settings body {',
    '  padding: 0 !important;',
    '}',
    'html.argus-settings .inputs,',
    'html.argus-settings #main-form.inputs {',
    '  max-width: 480px;',
    '  margin: 0 auto;',
    '  padding: 12px 12px 120px;',
    '  box-sizing: border-box;',
    '  background: transparent !important;',
    '}',
    'html.argus-settings .component {',
    '  padding-top: 0 !important;',
    '  color: inherit !important;',
    '  background: transparent !important;',
    '}',
    'html.argus-settings .component-heading {',
    '  display: none !important;',
    '}',
    'html.argus-settings .component.component-text:not(.argus-row) {',
    '  display: none !important;',
    '}',
    'html.argus-settings .component.component-text.argus-row > p {',
    '  margin: 0;',
    '  padding: 0;',
    '}',
    'html.argus-settings .component-toggle > label,',
    'html.argus-settings .argus-row.component-input > label {',
    '  padding: 0 !important;',
    '  color: inherit !important;',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group label {',
    '  display: -webkit-inline-flex !important;',
    '  display: inline-flex !important;',
    '  -webkit-box-pack: center;',
    '  justify-content: center !important;',
    '  -webkit-box-align: center;',
    '  align-items: center !important;',
    '}',
    'html.argus-settings .description {',
    '  color: #9aa1ab !important;',
    '  padding: 0 !important;',
    '  text-align: left !important;',
    '}',
    'html.argus-settings .argus-tabs {',
    '  display: -webkit-box;',
    '  display: -webkit-flex;',
    '  display: flex;',
    '  -webkit-flex-wrap: nowrap;',
    '  flex-wrap: nowrap;',
    '  gap: 6px;',
    '  overflow-x: auto;',
    '  overflow-y: hidden;',
    '  -webkit-overflow-scrolling: touch;',
    '  scrollbar-width: none;',
    '  -ms-overflow-style: none;',
    '  position: sticky;',
    '  top: 0;',
    '  z-index: 10;',
    '  background: #1a1d21 !important;',
    '  padding: 0 0 6px;',
    '  margin-bottom: 6px;',
    '}',
    'html.argus-settings .argus-tabs::-webkit-scrollbar {',
    '  display: none;',
    '  width: 0;',
    '  height: 0;',
    '}',
    'html.argus-settings .argus-tabs .argus-tab {',
    '  appearance: none;',
    '  -webkit-appearance: none;',
    '  display: inline-flex !important;',
    '  align-items: center;',
    '  justify-content: center;',
    '  width: auto !important;',
    '  min-width: 0 !important;',
    '  max-width: none !important;',
    '  flex: 0 0 auto;',
    '  flex-shrink: 0;',
    '  box-sizing: border-box;',
    '  min-height: 36px !important;',
    '  padding: 8px 14px !important;',
    '  margin: 0 !important;',
    '  border: 1px solid #464d58 !important;',
    '  border-radius: 9px !important;',
    '  background: #282c32 !important;',
    '  color: #b4bac3 !important;',
    '  font-family: inherit !important;',
    '  font-size: 13px !important;',
    '  font-weight: 600 !important;',
    '  line-height: 1.2 !important;',
    '  text-transform: none !important;',
    '  text-align: center !important;',
    '  cursor: pointer;',
    '  box-shadow: none !important;',
    '  -webkit-tap-highlight-color: transparent;',
    '}',
    'html.argus-settings .argus-tabs .argus-tab.active {',
    '  background: #4a6885 !important;',
    '  border-color: #4a6885 !important;',
    '  color: #ffffff !important;',
    '  box-shadow: 0 1px 4px rgba(74, 104, 133, 0.45) !important;',
    '}',
    'html.argus-settings .argus-tab-panel {',
    '  background: #282c32 !important;',
    '  border: 1px solid #464d58;',
    '  border-radius: 12px;',
    '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);',
    '  margin-bottom: 12px;',
    '  overflow: hidden;',
    '}',
    'html.argus-settings .argus-tab-panel.hide {',
    '  display: none !important;',
    '}',
    'html.argus-settings .argus-row {',
    '  padding: 18px 16px !important;',
    '  margin: 0 !important;',
    '  background: transparent !important;',
    '  border: none;',
    '  border-radius: 0;',
    '  box-shadow: none;',
    '}',
    'html.argus-settings .argus-tab-panel > .argus-row:first-child {',
    '  padding-top: 20px;',
    '}',
    'html.argus-settings .argus-tab-panel > .argus-row + .argus-row {',
    '  border-top: 1px solid #3a4048;',
    '  padding-top: 24px;',
    '}',
    'html.argus-settings .argus-tab-panel > .argus-row + .argus-row > .label,',
    'html.argus-settings .argus-tab-panel > .argus-row + .argus-row.component-toggle > label > .label,',
    'html.argus-settings .argus-tab-panel > .argus-row + .argus-row.component-input > label > .label {',
    '  margin-top: 4px;',
    '}',
    'html.argus-settings .argus-setting-label,',
    'html.argus-settings .argus-row > .label,',
    'html.argus-settings .argus-row.component-radio > .label,',
    'html.argus-settings .argus-row.component-toggle > label > .label,',
    'html.argus-settings .argus-row.component-input label > .label {',
    '  display: block;',
    '  font-size: 16px;',
    '  font-weight: 600;',
    '  color: #e8ebef !important;',
    '  margin-bottom: 10px !important;',
    '  padding: 0 !important;',
    '}',
    'html.argus-settings .argus-row.component-toggle > label > .label,',
    'html.argus-settings .component-toggle > label > .label {',
    '  margin-bottom: 0;',
    '}',
    'html.argus-settings .argus-row .description {',
    '  font-size: 13px;',
    '  color: #9aa1ab !important;',
    '  line-height: 1.45;',
    '  margin-top: 10px;',
    '  padding: 0;',
    '}',
    'html.argus-settings .argus-field-help {',
    '  display: block;',
    '  width: 100%;',
    '  font-size: 13px;',
    '  color: #9aa1ab !important;',
    '  line-height: 1.45;',
    '  margin-top: 10px;',
    '  padding: 0;',
    '}',
    'html.argus-settings .argus-field-help-secondary {',
    '  display: block;',
    '  width: 100%;',
    '  font-size: 13px;',
    '  color: #9aa1ab !important;',
    '  line-height: 1.45;',
    '  margin-top: 8px;',
    '  padding: 0;',
    '}',
    'html.argus-settings .argus-inline-control {',
    '  display: block;',
    '}',
    'html.argus-settings .argus-control-row {',
    '  display: -webkit-box;',
    '  display: -webkit-flex;',
    '  display: flex;',
    '  -webkit-box-align: start;',
    '  -webkit-align-items: flex-start;',
    '  align-items: flex-start;',
    '  gap: 12px;',
    '  margin-top: 0;',
    '}',
    'html.argus-settings .argus-control-row > .description {',
    '  -webkit-box-flex: 1;',
    '  -webkit-flex: 1 1 0;',
    '  flex: 1 1 0;',
    '  min-width: 0;',
    '  margin-top: 0 !important;',
    '}',
    'html.argus-settings .argus-control-row > .radio-group,',
    'html.argus-settings .argus-control-row > .argus-toggle-input {',
    '  -webkit-box-flex: 0;',
    '  -webkit-flex: 0 0 auto;',
    '  flex: 0 0 auto;',
    '  margin-left: auto;',
    '}',
    'html.argus-settings .argus-toggle-input {',
    '  padding: 0 !important;',
    '  margin: 0 !important;',
    '  display: -webkit-inline-flex !important;',
    '  display: inline-flex !important;',
    '  -webkit-box-align: start;',
    '  align-items: flex-start !important;',
    '}',
    'html.argus-settings .argus-segment-radiogroup > .label,',
    'html.argus-settings .argus-inline-control.component-toggle > .label {',
    '  display: block;',
    '  margin-bottom: 10px !important;',
    '}',
    'html.argus-settings .argus-title-inline-control {',
    '  display: -webkit-box;',
    '  display: -webkit-flex;',
    '  display: flex;',
    '  -webkit-box-align: center;',
    '  -webkit-align-items: center;',
    '  align-items: center;',
    '  -webkit-box-pack: justify;',
    '  -webkit-justify-content: space-between;',
    '  justify-content: space-between;',
    '  gap: 8px 12px;',
    '}',
    'html.argus-settings .argus-title-inline-control > .label {',
    '  -webkit-box-flex: 1;',
    '  -webkit-flex: 1 1 auto;',
    '  flex: 1 1 auto;',
    '  min-width: 0;',
    '  margin-bottom: 0 !important;',
    '}',
    'html.argus-settings .argus-title-inline-control > .radio-group {',
    '  -webkit-box-flex: 0;',
    '  -webkit-flex: 0 0 auto;',
    '  flex: 0 0 auto;',
    '  margin-left: auto;',
    '}',
    'html.argus-settings .argus-segment-radiogroup > .radio-group {',
    '  margin-left: auto;',
    '}',
    'html.argus-settings .argus-list-radiogroup {',
    '  display: -webkit-box;',
    '  display: -webkit-flex;',
    '  display: flex;',
    '  -webkit-box-orient: vertical;',
    '  -webkit-flex-direction: column;',
    '  flex-direction: column;',
    '}',
    'html.argus-settings .argus-list-radiogroup > .label {',
    '  -webkit-box-ordinal-group: 1;',
    '  order: 1;',
    '  display: block;',
    '  margin-bottom: 8px !important;',
    '}',
    'html.argus-settings .argus-list-radiogroup > .description {',
    '  -webkit-box-ordinal-group: 2;',
    '  order: 2;',
    '  margin-top: 0 !important;',
    '  margin-bottom: 10px !important;',
    '}',
    'html.argus-settings .argus-list-radiogroup > .radio-group {',
    '  -webkit-box-ordinal-group: 3;',
    '  order: 3;',
    '}',
    'html.argus-settings .argus-list-radiogroup > .argus-field-help {',
    '  -webkit-box-ordinal-group: 4;',
    '  order: 4;',
    '  margin-top: 10px;',
    '}',
    'html.argus-settings .argus-list-radiogroup > .argus-field-help-secondary {',
    '  -webkit-box-ordinal-group: 5;',
    '  order: 5;',
    '  margin-top: 8px;',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group {',
    '  display: inline-flex;',
    '  flex: 0 0 auto;',
    '  width: auto;',
    '  max-width: 100%;',
    '  margin-left: 0;',
    '  margin-right: 0;',
    '  gap: 4px;',
    '  padding: 4px;',
    '  background: #3a4048 !important;',
    '  border-radius: 9px;',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group label {',
    '  flex: 0 0 auto;',
    '  min-height: 30px;',
    '  margin: 0 !important;',
    '  padding: 6px 12px !important;',
    '  border: none;',
    '  border-radius: 7px;',
    '  cursor: pointer;',
    '  white-space: nowrap;',
    '  background: transparent !important;',
    '  max-width: none !important;',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group .label {',
    '  font-size: 13px;',
    '  font-weight: 600;',
    '  color: #b4bac3 !important;',
    '  text-align: center;',
    '  padding: 0 2px !important;',
    '  margin: 0 !important;',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group i {',
    '  display: none;',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group input {',
    '  position: absolute;',
    '  opacity: 0;',
    '  pointer-events: none;',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group label.active {',
    '  background: #4a6885 !important;',
    '  box-shadow: 0 1px 3px rgba(74, 104, 133, 0.4);',
    '}',
    'html.argus-settings .argus-segment-radiogroup .radio-group label.active .label {',
    '  color: #ffffff !important;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group {',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 2px;',
    '  padding: 3px;',
    '  background: #3a4048 !important;',
    '  border-radius: 9px;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group label {',
    '  display: -webkit-flex !important;',
    '  display: flex !important;',
    '  -webkit-box-align: center;',
    '  align-items: center !important;',
    '  -webkit-box-pack: justify;',
    '  justify-content: space-between !important;',
    '  gap: 12px;',
    '  min-height: 36px;',
    '  margin: 0 !important;',
    '  padding: 8px 14px !important;',
    '  border: 1px solid transparent;',
    '  border-radius: 7px;',
    '  cursor: pointer;',
    '  background: transparent !important;',
    '  box-sizing: border-box;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group .label {',
    '  flex: 1 1 auto;',
    '  min-width: 0;',
    '  font-size: 14px;',
    '  font-weight: 600;',
    '  color: #b4bac3 !important;',
    '  text-align: left;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group i {',
    '  display: block;',
    '  position: relative;',
    '  flex: 0 0 auto;',
    '  width: 22px;',
    '  height: 22px;',
    '  border: 2px solid #5a616c;',
    '  border-radius: 50%;',
    '  box-sizing: border-box;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group input {',
    '  position: absolute;',
    '  opacity: 0;',
    '  pointer-events: none;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group input:checked + i {',
    '  border-color: #8eb0d0;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group input:checked + i:after {',
    '  content: "";',
    '  display: block;',
    '  position: absolute;',
    '  left: 4px;',
    '  right: 4px;',
    '  top: 4px;',
    '  bottom: 4px;',
    '  border-radius: 50%;',
    '  background: #8eb0d0;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group label.active {',
    '  background: rgba(142, 176, 208, 0.28) !important;',
    '  border: 1px solid #8eb0d0 !important;',
    '  box-shadow: none;',
    '}',
    'html.argus-settings .argus-list-radiogroup .radio-group label.active .label {',
    '  color: #e8ebef !important;',
    '}',
    'html.argus-settings .argus-row.component-toggle > label,',
    'html.argus-settings .component-toggle > label {',
    '  padding: 0 !important;',
    '  cursor: pointer;',
    '}',
    'html.argus-settings .argus-row.component-toggle:not(.argus-inline-control) > label,',
    'html.argus-settings .component-toggle:not(.argus-inline-control) > label {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  gap: 12px;',
    '  min-height: 0;',
    '}',
    'html.argus-settings .argus-row.component-toggle > label > .label,',
    'html.argus-settings .component-toggle > label > .label {',
    '  flex: 1 1 auto;',
    '  min-width: 0;',
    '  padding-right: 0;',
    '  color: #e8ebef !important;',
    '}',
    'html.argus-settings .argus-row.component-toggle > label > .input,',
    'html.argus-settings .component-toggle > label > .input {',
    '  flex: 0 0 auto;',
    '  max-width: none !important;',
    '  width: auto !important;',
    '  margin-left: 0 !important;',
    '  white-space: nowrap;',
    '}',
    'html.argus-settings .component-toggle .graphic .slide {',
    '  display: block;',
    '  width: 44px !important;',
    '  height: 26px !important;',
    '  border-radius: 13px !important;',
    '  background: #404650 !important;',
    '}',
    'html.argus-settings .component-toggle .graphic .marker {',
    '  width: 22px !important;',
    '  height: 22px !important;',
    '  top: 2px !important;',
    '  left: 2px !important;',
    '  background: #d4d7dc !important;',
    '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35) !important;',
    '}',
    'html.argus-settings .component-toggle input:checked + .graphic .slide {',
    '  background: #4a6885 !important;',
    '  box-shadow: 0 1px 3px rgba(74, 104, 133, 0.4) !important;',
    '}',
    'html.argus-settings .component-toggle input:checked + .graphic .marker {',
    '  background: #e8ebef !important;',
    '  transform: translateX(18px) !important;',
    '}',
    'html.argus-settings .argus-row.component-input > label {',
    '  display: block;',
    '  padding: 0 !important;',
    '}',
    'html.argus-settings .argus-row.component-input > label.tap-highlight,',
    'html.argus-settings .argus-row.component-input > label.tap-highlight:active,',
    'html.argus-settings .argus-row.component-input > label.tap-highlight:focus,',
    'html.argus-settings .argus-row.component-input > label.tap-highlight:focus-within {',
    '  -webkit-tap-highlight-color: transparent !important;',
    '  background: transparent !important;',
    '  background-color: transparent !important;',
    '}',
    'html.argus-settings .argus-row.component-input .input {',
    '  margin-top: 8px;',
    '  margin-left: 0 !important;',
    '  max-width: none !important;',
    '}',
    'html.argus-settings .argus-row.component-input input,',
    'html.argus-settings .argus-row.component-input input.argus-city-input {',
    '  width: 100%;',
    '  box-sizing: border-box;',
    '  min-height: 44px;',
    '  padding: 10px 12px;',
    '  border: 1px solid #c5cad1 !important;',
    '  border-radius: 10px;',
    '  font-size: 16px;',
    '  background: #ffffff !important;',
    '  background-color: #ffffff !important;',
    '  color: #1a1d21 !important;',
    '  color-scheme: light;',
    '  -webkit-appearance: none;',
    '  appearance: none;',
    '  -webkit-tap-highlight-color: transparent;',
    '  box-shadow: none !important;',
    '}',
    'html.argus-settings .argus-row.component-input input::-webkit-input-placeholder {',
    '  color: #8a919a;',
    '}',
    'html.argus-settings .argus-row.component-input input:focus {',
    '  outline: none;',
    '  border-color: #4a6885 !important;',
    '  background: #ffffff !important;',
    '  background-color: #ffffff !important;',
    '  color: #1a1d21 !important;',
    '}',
    'html.argus-settings .argus-row.component-input.disabled input {',
    '  opacity: 0.55;',
    '  background: #e8ebef !important;',
    '  background-color: #e8ebef !important;',
    '  color: #6b7280 !important;',
    '}',
    'html.argus-settings .argus-footer {',
    '  text-align: center;',
    '  font-size: 13px;',
    '  color: #7a828d !important;',
    '  padding: 8px 0 16px;',
    '}',
    'html.argus-settings .argus-footer a {',
    '  color: #6894b8 !important;',
    '  text-decoration: none;',
    '}',
    'html.argus-settings .argus-precip-info {',
    '  color: inherit;',
    '}',
    'html.argus-settings .argus-wind-info {',
    '  color: inherit;',
    '}',
    'html.argus-settings .argus-precip-info > .argus-setting-label,',
    'html.argus-settings .argus-wind-info > .argus-setting-label {',
    '  margin-bottom: 8px !important;',
    '}',
    'html.argus-settings .argus-precip-intro {',
    '  font-size: 13px;',
    '  color: #9aa1ab !important;',
    '  line-height: 1.45;',
    '  margin: 0 0 14px;',
    '}',
    'html.argus-settings .argus-precip-table-wrap {',
    '  overflow-x: auto;',
    '  -webkit-overflow-scrolling: touch;',
    '  margin-bottom: 12px;',
    '}',
    'html.argus-settings .argus-precip-table {',
    '  width: 100%;',
    '  border-collapse: collapse;',
    '  font-size: 13px;',
    '}',
    'html.argus-settings .argus-precip-table th,',
    'html.argus-settings .argus-precip-table td {',
    '  padding: 8px 10px;',
    '  text-align: left;',
    '  border-bottom: 1px solid #3a4048;',
    '  vertical-align: top;',
    '}',
    'html.argus-settings .argus-precip-table th {',
    '  font-size: 12px;',
    '  font-weight: 600;',
    '  color: #b4bac3;',
    '  background: #23272d;',
    '}',
    'html.argus-settings .argus-precip-table td {',
    '  color: #e8ebef;',
    '}',
    'html.argus-settings .argus-precip-table tr:last-child td {',
    '  border-bottom: none;',
    '}',
    'html.argus-settings .argus-precip-example {',
    '  font-size: 13px;',
    '  color: #9aa1ab !important;',
    '  line-height: 1.45;',
    '  margin: 0;',
    '}',
    'html.argus-settings .argus-wind-note {',
    '  font-size: 13px;',
    '  color: #9aa1ab !important;',
    '  line-height: 1.45;',
    '  margin: 12px 0 0;',
    '}',
    'html.argus-settings .argus-wind-note em {',
    '  font-style: normal;',
    '  color: #f5d442;',
    '}',
    'html.argus-settings .component-submit {',
    '  position: fixed;',
    '  left: 0;',
    '  right: 0;',
    '  bottom: 0;',
    '  z-index: 20;',
    '  padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px)) !important;',
    '  background: #1a1d21 !important;',
    '  border-top: 1px solid #464d58;',
    '  box-sizing: border-box;',
    '}',
    'html.argus-settings .component-submit button {',
    '  width: 100%;',
    '  max-width: 448px;',
    '  min-width: 0 !important;',
    '  min-height: 48px;',
    '  margin: 0 auto !important;',
    '  display: block;',
    '  border: none !important;',
    '  border-radius: 12px !important;',
    '  background: #4a6885 !important;',
    '  color: #ffffff !important;',
    '  font-family: inherit !important;',
    '  font-size: 17px !important;',
    '  font-weight: 600 !important;',
    '  text-transform: none !important;',
    '  cursor: pointer;',
    '  box-shadow: 0 2px 6px rgba(74, 104, 133, 0.4) !important;',
    '}',
  ].join('\n');

  function injectTheme() {
    document.documentElement.classList.add('argus-settings');

    var meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'color-scheme');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'dark');

    var existingTheme = document.getElementById('argus-theme');
    if (existingTheme) {
      existingTheme.parentNode.removeChild(existingTheme);
    }

    var style = document.createElement('style');
    style.id = 'argus-theme';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(THEME_CSS));
    document.head.appendChild(style);
  }

  function injectTabs() {
    var form = clayConfig.$rootContainer && clayConfig.$rootContainer[0];
    if (!form) {
      return null;
    }

    var tabs = document.createElement('div');
    tabs.className = 'argus-tabs';
    tabs.innerHTML =
      '<button type="button" class="argus-tab active" data-tab="tabTime">General</button>' +
      '<button type="button" class="argus-tab" data-tab="tabDisplay">Display</button>' +
      '<button type="button" class="argus-tab" data-tab="tabWeather">Weather</button>' +
      '<button type="button" class="argus-tab" data-tab="tabDebug">Debug</button>';

    if (form.firstChild) {
      form.insertBefore(tabs, form.firstChild);
    } else {
      form.appendChild(tabs);
    }

    return tabs;
  }

  function injectFooter() {
    var footerItem = clayConfig.getItemById('argus-footer');
    if (!footerItem) {
      return;
    }

    var userData = clayConfig.meta.userData || {};
    var version = userData.version || '0.0.0';
    var githubUrl = userData.githubUrl || 'https://github.com/filcuk/pebble-watchface-argus';

    footerItem.set(
      '<div class="argus-footer">Argus v' + version + ' · ' +
      '<a href="' + githubUrl + '" target="_blank" rel="noopener noreferrer">View on GitHub</a></div>'
    );

    if (footerItem.$element && footerItem.$element[0]) {
      footerItem.$element[0].classList.add('argus-row');
    }
  }

  function injectPrecipitationInfo() {
    var infoItem = clayConfig.getItemById('argus-precipitation-info');
    if (!infoItem) {
      return;
    }

    infoItem.set(
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
      '</div>'
    );

    if (infoItem.$element && infoItem.$element[0]) {
      infoItem.$element[0].classList.add('argus-row');
    }
  }

  function injectWindInfo() {
    var infoItem = clayConfig.getItemById('argus-wind-info');
    if (!infoItem) {
      return;
    }

    infoItem.set(
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
      '</div>'
    );

    if (infoItem.$element && infoItem.$element[0]) {
      infoItem.$element[0].classList.add('argus-row');
    }
  }

  function applyRowStyles() {
    var allKeys = SEGMENT_KEYS.concat(LIST_RADIO_KEYS).concat([
      'ManualLocation',
      'TemperatureDisplay',
      'PauseWeatherAtNight',
      'DebugMode',
      'DemoWeather',
      'DemoBiometrics',
    ]);

    allKeys.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item && item.$element && item.$element[0]) {
        item.$element[0].classList.add('argus-row');
      }
    });

    var precipInfo = clayConfig.getItemById('argus-precipitation-info');
    if (precipInfo && precipInfo.$element && precipInfo.$element[0]) {
      precipInfo.$element[0].classList.add('argus-row');
    }

    var windInfo = clayConfig.getItemById('argus-wind-info');
    if (windInfo && windInfo.$element && windInfo.$element[0]) {
      windInfo.$element[0].classList.add('argus-row');
    }

    var manualLocation = clayConfig.getItemByMessageKey('ManualLocation');
    if (manualLocation && manualLocation.$element && manualLocation.$element[0]) {
      var inputLabel = manualLocation.$element[0].querySelector('label.tap-highlight');
      if (inputLabel) {
        inputLabel.classList.remove('tap-highlight');
      }

      var cityInput = manualLocation.$element[0].querySelector('input');
      if (cityInput) {
        cityInput.classList.add('argus-city-input');
        cityInput.style.backgroundColor = '#ffffff';
        cityInput.style.color = '#1a1d21';
      }
    }

    SEGMENT_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item && item.$element && item.$element[0]) {
        item.$element[0].classList.add('argus-segment-radiogroup');
      }
    });

    LIST_RADIO_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item && item.$element && item.$element[0]) {
        item.$element[0].classList.add('argus-list-radiogroup');
      }
    });

    INLINE_CONTROL_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item && item.$element && item.$element[0]) {
        item.$element[0].classList.add('argus-inline-control');
      }
    });

    TITLE_INLINE_SEGMENT_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item && item.$element && item.$element[0]) {
        item.$element[0].classList.add('argus-title-inline-control');
      }
    });

    allKeys.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (!item || !item.$element || !item.$element[0]) {
        return;
      }
      var root = item.$element[0];
      var mainLabel = root.querySelector(':scope > .label');
      if (!mainLabel) {
        mainLabel = root.querySelector('label > .label');
      }
      if (mainLabel) {
        mainLabel.classList.add('argus-setting-label');
      }
    });
  }

  function wrapInlineControlBodies() {
    INLINE_CONTROL_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (!item || !item.$element || !item.$element[0]) {
        return;
      }

      var root = item.$element[0];
      if (root.querySelector(':scope > .argus-control-row')) {
        return;
      }

      if (root.classList.contains('argus-segment-radiogroup')) {
        var segmentDesc = root.querySelector(':scope > .description');
        var segmentControl = root.querySelector(':scope > .radio-group');
        if (!segmentDesc || !segmentControl) {
          return;
        }

        var segmentRow = document.createElement('div');
        segmentRow.className = 'argus-control-row';
        root.insertBefore(segmentRow, segmentDesc);
        segmentRow.appendChild(segmentDesc);
        segmentRow.appendChild(segmentControl);
        return;
      }

      if (root.classList.contains('component-toggle')) {
        var toggleLabel = root.querySelector(':scope > label');
        var toggleDesc = root.querySelector(':scope > .description');
        if (!toggleLabel || !toggleDesc) {
          return;
        }

        var title = toggleLabel.querySelector('.label');
        var input = toggleLabel.querySelector('.input');
        if (!title || !input) {
          return;
        }

        root.insertBefore(title, toggleLabel);
        var toggleRow = document.createElement('div');
        toggleRow.className = 'argus-control-row';
        root.insertBefore(toggleRow, toggleDesc);
        toggleRow.appendChild(toggleDesc);

        var inputLabel = document.createElement('label');
        inputLabel.className = 'argus-toggle-input tap-highlight';
        inputLabel.appendChild(input);
        toggleRow.appendChild(inputLabel);
        toggleLabel.remove();
      }
    });
  }

  function wrapTabPanels() {
    var form = clayConfig.$rootContainer && clayConfig.$rootContainer[0];
    if (!form) {
      return;
    }

    TAB_GROUPS.forEach(function (tab) {
      var items = clayConfig.getItemsByGroup(tab);
      if (!items.length) {
        return;
      }

      var panel = document.createElement('div');
      panel.className = 'argus-tab-panel hide';
      panel.setAttribute('data-tab-panel', tab);

      var firstEl = items[0].$element[0];
      form.insertBefore(panel, firstEl);

      items.forEach(function (item) {
        panel.appendChild(item.$element[0]);
      });
    });
  }

  function syncDebugToggles() {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var demoWeatherToggle = clayConfig.getItemByMessageKey('DemoWeather');
    var demoBiometricsToggle = clayConfig.getItemByMessageKey('DemoBiometrics');

    if (!debugToggle || !demoWeatherToggle || !demoBiometricsToggle) {
      return;
    }

    if (debugToggle.get()) {
      demoWeatherToggle.enable();
      demoBiometricsToggle.enable();
    } else {
      demoWeatherToggle.set(false);
      demoWeatherToggle.disable();
      demoBiometricsToggle.set(false);
      demoBiometricsToggle.disable();
    }
  }

  function syncManualLocationInput() {
    var locationMode = clayConfig.getItemByMessageKey('LocationMode');
    var manualLocation = clayConfig.getItemByMessageKey('ManualLocation');
    var gpsMaxAge = clayConfig.getItemByMessageKey('GpsMaxAge');

    if (!locationMode) {
      return;
    }

    var isManual = locationMode.get() === '1';

    if (manualLocation && manualLocation.$element && manualLocation.$element[0]) {
      var manualRoot = manualLocation.$element[0];
      if (isManual) {
        manualRoot.classList.remove('hide');
        manualLocation.enable();
        if (manualLocation.$manipulatorTarget && manualLocation.$manipulatorTarget[0]) {
          manualLocation.$manipulatorTarget[0].focus();
        }
      } else {
        manualRoot.classList.add('hide');
        manualLocation.disable();
      }
    }

    if (gpsMaxAge && gpsMaxAge.$element && gpsMaxAge.$element[0]) {
      if (isManual) {
        gpsMaxAge.$element[0].classList.add('hide');
      } else {
        gpsMaxAge.$element[0].classList.remove('hide');
      }
    }
  }

  function syncRadioLabels(key) {
    var item = clayConfig.getItemByMessageKey(key);
    if (!item || !item.$element) {
      return;
    }

    item.$element.select('.radio-group label').each(function (label) {
      var input = label.querySelector('input');
      if (input && input.checked) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  function bindSegmentSync() {
    SEGMENT_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (!item) {
        return;
      }
      syncRadioLabels(key);
      item.on('change', function () {
        syncRadioLabels(key);
      });
    });

    LIST_RADIO_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (!item) {
        return;
      }
      syncRadioLabels(key);
      item.on('change', function () {
        syncRadioLabels(key);
      });
    });
  }

  function normalizeRealtimeStepsDefault() {
    var item = clayConfig.getItemByMessageKey('RealtimeSteps');
    if (!item) {
      return;
    }

    var validValues = { '0': true, '1': true, '2': true };
    var value = item.get();

    if (!validValues[value]) {
      if (value === true || value === 'true' || value === 1) {
        item.set('1');
      } else {
        item.set('0');
      }
    }

    syncRadioLabels('RealtimeSteps');

    try {
      var stored = JSON.parse(localStorage.getItem('clay-settings')) || {};
      var storedValue = stored.RealtimeSteps;
      if (storedValue && typeof storedValue === 'object' && 'value' in storedValue) {
        storedValue = storedValue.value;
      }
      if (!validValues[storedValue]) {
        if (storedValue === true || storedValue === 'true' || storedValue === 1) {
          stored.RealtimeSteps = '1';
        } else {
          stored.RealtimeSteps = '0';
        }
        localStorage.setItem('clay-settings', JSON.stringify(stored));
      }
    } catch (e) {
      // Ignore localStorage errors in the config page.
    }
  }

  function appendFieldHelp(messageKey, text, secondaryClass) {
    var item = clayConfig.getItemByMessageKey(messageKey);
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var root = item.$element[0];
    var className = secondaryClass || 'argus-field-help-secondary';
    if (root.querySelector(':scope > .' + className)) {
      return;
    }

    var help = document.createElement('div');
    help.className = className;
    help.textContent = text;

    var primaryHelp = root.querySelector(':scope > .argus-field-help');
    if (primaryHelp) {
      if (primaryHelp.nextSibling) {
        root.insertBefore(help, primaryHelp.nextSibling);
      } else {
        root.appendChild(help);
      }
      return;
    }

    root.appendChild(help);
  }

  function injectFieldHelp(messageKey, text) {
    var item = clayConfig.getItemByMessageKey(messageKey);
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var root = item.$element[0];
    if (root.querySelector(':scope > .argus-field-help')) {
      return;
    }

    var help = document.createElement('div');
    help.className = 'argus-field-help';
    help.textContent = text;

    var description = root.querySelector(':scope > .description');
    if (description) {
      if (description.nextSibling) {
        root.insertBefore(help, description.nextSibling);
      } else {
        root.appendChild(help);
      }
      return;
    }

    var anchor = root.querySelector(':scope > .argus-control-row') ||
      root.querySelector(':scope > .radio-group');
    if (anchor) {
      if (anchor.nextSibling) {
        root.insertBefore(help, anchor.nextSibling);
      } else {
        root.appendChild(help);
      }
    } else {
      root.appendChild(help);
    }
  }

  function injectSettingsFieldHelp() {
    injectFieldHelp(
      'WeekNumberMode',
      'ISO 8601 is the international standard. Week 1 is determined by the first Thursday ' +
      'of the year. US traditional style is typically used in North America. US week 1 is ' +
      'the week containing 1st of January.'
    );
    injectFieldHelp(
      'HeaderDisplay',
      'Step count shows your total steps for the day. Temperature shows the current ' +
      'reading with today\'s minimum and maximum forecasted. Heart rate ' +
      'shows your current BPM with today\'s maximum.'
    );
    appendFieldHelp(
      'HeaderDisplay',
      'Maximum heart rate is recorded while Argus is active. When you open the watchface, ' +
      'earlier peaks from today may be included if the watch already stored minute ' +
      'heart-rate samples.'
    );
    injectFieldHelp(
      'WeatherProvider',
      'All models are served by Open-Meteo without an API key. Auto combines the highest-' +
      'resolution model available for your coordinates.'
    );
    injectFieldHelp(
      'WeatherUpdateInterval',
      'Shorter intervals keep data fresher but use more phone and watch battery.'
    );
    injectFieldHelp(
      'GpsMaxAge',
      'This setting affects battery life.'
    );
  }

  function hideHeaderHeartRateIfNeeded() {
    var headerItem = clayConfig.getItemByMessageKey('HeaderDisplay');
    var healthItem = clayConfig.getItemByMessageKey('RealtimeSteps');

    if (!headerItem || healthItem) {
      return;
    }

    headerItem.$element.select('input[value="3"]').each(function (input) {
      var label = input.parentNode;
      if (label) {
        label.style.display = 'none';
      }
    });

    if (headerItem.get() === '3') {
      headerItem.set('0');
    }
  }

  function showTab(activeTab, tabsRoot) {
    var form = clayConfig.$rootContainer && clayConfig.$rootContainer[0];
    if (form) {
      var panels = form.querySelectorAll('.argus-tab-panel');
      var i;
      for (i = 0; i < panels.length; i += 1) {
        var panel = panels[i];
        if (panel.getAttribute('data-tab-panel') === activeTab) {
          panel.classList.remove('hide');
        } else {
          panel.classList.add('hide');
        }
      }
    }

    if (!tabsRoot) {
      return;
    }

    var buttons = tabsRoot.querySelectorAll('.argus-tab');
    var j;
    var activeButton = null;
    for (j = 0; j < buttons.length; j += 1) {
      var btn = buttons[j];
      if (btn.getAttribute('data-tab') === activeTab) {
        btn.classList.add('active');
        activeButton = btn;
      } else {
        btn.classList.remove('active');
      }
    }

    if (activeButton && activeButton.scrollIntoView) {
      activeButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var locationMode = clayConfig.getItemByMessageKey('LocationMode');

    var tabsRoot = injectTabs();
    injectFooter();
    applyRowStyles();
    wrapTabPanels();
    wrapInlineControlBodies();
    injectPrecipitationInfo();
    injectWindInfo();
    injectSettingsFieldHelp();
    hideHeaderHeartRateIfNeeded();
    normalizeRealtimeStepsDefault();
    bindSegmentSync();

    if (tabsRoot) {
      tabsRoot.addEventListener('click', function (e) {
        var btn = e.target;
        while (btn && btn !== tabsRoot && !btn.getAttribute('data-tab')) {
          btn = btn.parentNode;
        }
        if (btn && btn.getAttribute('data-tab')) {
          showTab(btn.getAttribute('data-tab'), tabsRoot);
        }
      });
      showTab('tabTime', tabsRoot);
    }

    syncDebugToggles();
    if (debugToggle) {
      debugToggle.on('change', syncDebugToggles);
    }

    syncManualLocationInput();
    if (locationMode) {
      locationMode.on('change', syncManualLocationInput);
    }

    injectTheme();
  });
};
