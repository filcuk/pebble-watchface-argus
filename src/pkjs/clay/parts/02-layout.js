  var TAB_GROUPS = ['tabTime', 'tabCalendar', 'tabDisplay', 'tabWeather', 'tabDebug'];
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
    'HolidayRegion',
  ];
  var SELECT_DROPDOWN_KEYS = ['HolidayCountry', 'ReleaseNotification'];
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
    'ShowHolidays',
    'DebugMode',
    'DemoWeather',
    'DemoBiometrics',
  ]);

  function injectTabs() {
    var form = clayConfig.$rootContainer && clayConfig.$rootContainer[0];
    if (!form) {
      return null;
    }

    var tabs = document.createElement('div');
    tabs.className = 'argus-tabs';
    tabs.innerHTML =
      '<button type="button" class="argus-tab active" data-tab="tabTime">General</button>' +
      '<button type="button" class="argus-tab" data-tab="tabCalendar">Calendar</button>' +
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
      footerItem.$element[0].classList.add('argus-row', 'argus-footer-row');
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
      'ShowHolidays',
      'DebugMode',
      'DemoWeather',
      'DemoBiometrics',
      'HolidayCountry',
      'HolidayRegion',
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

    SELECT_DROPDOWN_KEYS.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item && item.$element && item.$element[0]) {
        item.$element[0].classList.add('argus-select-control');
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

    function wrapPanelForGroup(tabId, groupId) {
      var items = clayConfig.getItemsByGroup(groupId);
      if (!items.length) {
        return;
      }

      var panel = document.createElement('div');
      panel.className = 'argus-tab-panel hide';
      panel.setAttribute('data-tab-panel', tabId);

      var firstEl = items[0].$element[0];
      form.insertBefore(panel, firstEl);

      items.forEach(function (item) {
        panel.appendChild(item.$element[0]);
      });
    }

    TAB_GROUPS.forEach(function (tab) {
      if (tab === 'tabWeather') {
        wrapPanelForGroup('tabWeather', 'tabWeather');
        wrapPanelForGroup('tabWeather', 'tabWeatherHelp');
        return;
      }

      wrapPanelForGroup(tab, tab);
    });
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

