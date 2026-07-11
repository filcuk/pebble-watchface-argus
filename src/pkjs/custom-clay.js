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
  var LIST_RADIO_KEYS = ['HeaderDisplay', 'ClockFont', 'RealtimeSteps'];
  var INLINE_CONTROL_KEYS = SEGMENT_KEYS.concat([
    'TemperatureDisplay',
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
    'html.argus-settings .component-heading,',
    'html.argus-settings .component-text {',
    '  display: none !important;',
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
    '  display: flex;',
    '  flex-wrap: wrap;',
    '  gap: 6px;',
    '  position: sticky;',
    '  top: 0;',
    '  z-index: 10;',
    '  background: #1a1d21 !important;',
    '  padding: 0 0 6px;',
    '  margin-bottom: 6px;',
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
    '  box-sizing: border-box;',
    '  min-height: 36px !important;',
    '  padding: 8px 18px !important;',
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
    'html.argus-settings .argus-segment-radiogroup > .radio-group {',
    '  margin-left: auto;',
    '}',
    'html.argus-settings .argus-list-radiogroup > .description {',
    '  margin-top: 10px;',
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
    '  padding: 6px 16px !important;',
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
    '  padding: 0 4px !important;',
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
    'html.argus-settings .argus-list-radiogroup > .label {',
    '  display: block;',
    '  margin-bottom: 10px !important;',
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
    'html.argus-settings .argus-row.component-input .input {',
    '  margin-top: 8px;',
    '  margin-left: 0 !important;',
    '  max-width: none !important;',
    '}',
    'html.argus-settings .component-input input[type="text"] {',
    '  width: 100%;',
    '  box-sizing: border-box;',
    '  min-height: 44px;',
    '  padding: 10px 12px;',
    '  border: 1px solid #464d58 !important;',
    '  border-radius: 10px;',
    '  font-size: 16px;',
    '  background: #32373f !important;',
    '  color: #e8ebef !important;',
    '}',
    'html.argus-settings .component-input.disabled input[type="text"] {',
    '  opacity: 0.55;',
    '  background: #282c32 !important;',
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
  }

  function applyRowStyles() {
    var allKeys = SEGMENT_KEYS.concat(LIST_RADIO_KEYS).concat([
      'ManualLocation',
      'TemperatureDisplay',
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

    if (!locationMode || !manualLocation) {
      return;
    }

    if (locationMode.get() === '1') {
      manualLocation.enable();
      if (manualLocation.$manipulatorTarget && manualLocation.$manipulatorTarget[0]) {
        manualLocation.$manipulatorTarget[0].focus();
      }
    } else {
      manualLocation.disable();
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

  function injectCalendarTypeHelp() {
    var item = clayConfig.getItemByMessageKey('WeekNumberMode');
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var root = item.$element[0];
    if (root.querySelector(':scope > .argus-field-help')) {
      return;
    }

    var help = document.createElement('div');
    help.className = 'argus-field-help';
    help.textContent =
      'ISO 8601 weeks start on Monday. Week 1 is the week that contains the first Thursday ' +
      'of the year, so week numbers near January can differ from the US style. US week 1 is ' +
      'the week containing January 1, with week numbers counting through the calendar year.';

    var anchor = root.querySelector(':scope > .argus-control-row');
    if (anchor) {
      root.insertBefore(help, anchor.nextSibling);
    } else {
      root.appendChild(help);
    }
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
    for (j = 0; j < buttons.length; j += 1) {
      var btn = buttons[j];
      if (btn.getAttribute('data-tab') === activeTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
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
    injectCalendarTypeHelp();
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
