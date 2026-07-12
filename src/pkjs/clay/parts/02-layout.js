  var TAB_GROUPS = ['tabTime', 'tabDisplay', 'tabCalendar', 'tabWeather', 'tabDebug'];
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
    'ReleaseNotification',
  ];
  var SELECT_DROPDOWN_KEYS = ['HolidayCountry'];
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
    'QuietModeDisplay',
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
      '<button type="button" class="argus-tab" data-tab="tabDisplay">Display</button>' +
      '<button type="button" class="argus-tab" data-tab="tabCalendar">Calendar</button>' +
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

  function applyRowStyles() {
    var allKeys = SEGMENT_KEYS.concat(LIST_RADIO_KEYS).concat([
      'ManualLocation',
      'TemperatureDisplay',
      'PauseWeatherAtNight',
      'QuietModeDisplay',
      'ShowHolidays',
      'DebugMode',
      'DemoWeather',
      'DemoBiometrics',
      'ReleaseNotification',
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

  function injectListRadiogroupHelp(messageKey, helpItemId) {
    var settingItem = clayConfig.getItemByMessageKey(messageKey);
    var helpItem = clayConfig.getItemById(helpItemId);
    if (!settingItem || !settingItem.$element || !settingItem.$element[0] || !helpItem) {
      return;
    }

    var root = settingItem.$element[0];
    if (root.querySelector(':scope > .argus-list-help-after')) {
      return;
    }

    var radioGroup = root.querySelector(':scope > .radio-group');
    if (!radioGroup) {
      return;
    }

    var helpHtml = String((helpItem.config && helpItem.config.defaultValue) || helpItem.get() || '');
    if (!helpHtml) {
      return;
    }

    var help = document.createElement('div');
    help.className = 'description argus-list-help-after';
    help.innerHTML = helpHtml;
    radioGroup.parentNode.insertBefore(help, radioGroup.nextSibling);

    if (helpItem.$element && helpItem.$element[0]) {
      helpItem.$element[0].remove();
    }
  }

  function injectSplitListRadiogroupHelp() {
    injectListRadiogroupHelp('HeaderDisplay', 'argus-header-display-help');
    injectListRadiogroupHelp('RealtimeSteps', 'argus-realtime-steps-help');
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

