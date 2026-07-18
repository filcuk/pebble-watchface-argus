  var TAB_GROUPS = ['tabAbout', 'tabTime', 'tabDisplay', 'tabCalendar', 'tabWeather', 'tabDebug'];
  var SEGMENT_KEYS = [
    'HourFormat',
    'WeekStart',
    'WeekNumberMode',
    'BluetoothDisplay',
    'LocationMode',
    'ForecastHours',
    'TemperatureUnit',
    'WindUnit',
  ];
  var LIST_RADIO_KEYS = [
    'HeaderDisplay',
    'FullDateFormat',
    'ClockFont',
    'RealtimeSteps',
    'WeatherProvider',
    'GpsMaxAge',
    'WeatherUpdateInterval',
    'HolidayRegion',
    'ReleaseNotification',
  ];
  var SELECT_DROPDOWN_KEYS = ['HolidayCountry'];
  var SUBHEADING_KEYS = [];
  var TITLE_INLINE_SEGMENT_KEYS = [
    'HourFormat',
    'WeekStart',
    'LocationMode',
    'TemperatureUnit',
    'WindUnit',
  ];
  var INLINE_CONTROL_KEYS = SEGMENT_KEYS.filter(function (key) {
    return TITLE_INLINE_SEGMENT_KEYS.indexOf(key) === -1;
  }).concat([
    'TemperatureDisplay',
    'PauseWeatherAtNight',
    'QuietModeDisplay',
    'ShowHolidays',
    'WeatherForceUpdate',
    'DebugMode',
    'DemoWeather',
    'DemoBiometrics',
    'DebugWeatherLog',
  ]);

  function injectTabs() {
    var form = clayConfig.$rootContainer && clayConfig.$rootContainer[0];
    if (!form) {
      return null;
    }

    var tabs = document.createElement('div');
    tabs.className = 'argus-tabs';
    tabs.innerHTML =
      '<button type="button" class="argus-tab active" data-tab="tabAbout">About</button>' +
      '<button type="button" class="argus-tab" data-tab="tabTime">General</button>' +
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
      'WeatherForceUpdate',
      'DebugMode',
      'DemoWeather',
      'DemoBiometrics',
      'ReleaseNotification',
      'DebugWeatherLog',
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

    var weatherLog = clayConfig.getItemById('argus-weather-debug-log');
    if (weatherLog && weatherLog.$element && weatherLog.$element[0]) {
      weatherLog.$element[0].classList.add('hide');
    }

    var aboutStatus = clayConfig.getItemById('argus-about-status');
    if (aboutStatus && aboutStatus.$element && aboutStatus.$element[0]) {
      aboutStatus.$element[0].classList.add('argus-row', 'argus-about-row');
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
      var isSubheading = SUBHEADING_KEYS.indexOf(key) !== -1;
      if (isSubheading) {
        root.classList.add('argus-subheading-control');
      }
      var mainLabel = root.querySelector(':scope > .label');
      if (!mainLabel) {
        mainLabel = root.querySelector('label > .label');
      }
      if (mainLabel) {
        mainLabel.classList.add(
          isSubheading ? 'argus-setting-subheading' : 'argus-setting-label'
        );
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

  // 14x14 watchface header glyphs (row bitmasks, bit13 = leftmost pixel).
  var HEADER_OPTION_ICON_MASKS = {
    '1': [0x0000, 0x0140, 0x0d10, 0x0c00, 0x00e0, 0x03f0, 0x03f8, 0x01f8, 0x0078, 0x0078, 0x0078, 0x00f0, 0x0060, 0x0000],
    '3': [0x0000, 0x0000, 0x0e1c, 0x1f3e, 0x1ffe, 0x1ff0, 0x1fe0, 0x0f84, 0x0704, 0x032a, 0x0110, 0x0090, 0x0000, 0x0000],
    '2': [0x0000, 0x01e0, 0x0210, 0x0610, 0x0210, 0x0210, 0x0610, 0x02d0, 0x02d0, 0x06d0, 0x02d0, 0x0210, 0x01e0, 0x0000],
    '4': [0x0000, 0x0030, 0x0008, 0x0008, 0x1ff0, 0x0000, 0x0004, 0x0004, 0x0ff8, 0x0000, 0x0002, 0x0002, 0x07fc, 0x0000],
  };

  function createHeaderOptionIconSvg(maskRows) {
    var parts = [];
    for (var row = 0; row < 14; row++) {
      var bits = maskRows[row];
      for (var col = 0; col < 14; col++) {
        if (bits & (1 << (13 - col))) {
          parts.push('M' + col + ' ' + row + 'h1v1h-1z');
        }
      }
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="14" height="14" ' +
      'shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="' +
      parts.join('') +
      '"/></svg>'
    );
  }

  function injectHeaderDisplayIcons() {
    var item = clayConfig.getItemByMessageKey('HeaderDisplay');
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var labels = item.$element[0].querySelectorAll('.radio-group > label');
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (label.querySelector('.argus-header-option-main')) {
        continue;
      }

      var text = label.querySelector('.label');
      var input = label.querySelector('input');
      if (!text || !input) {
        continue;
      }

      var main = document.createElement('span');
      main.className = 'argus-header-option-main';

      var icon = document.createElement('span');
      icon.className = 'argus-header-option-icon';
      var mask = HEADER_OPTION_ICON_MASKS[input.value];
      if (mask) {
        icon.innerHTML = createHeaderOptionIconSvg(mask);
      }

      label.insertBefore(main, text);
      main.appendChild(icon);
      main.appendChild(text);
    }
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

  function bindTabSwipe(tabsRoot) {
    var form = clayConfig.$rootContainer && clayConfig.$rootContainer[0];
    if (!form || !tabsRoot) {
      return;
    }

    var SWIPE_MIN_DX = 60;
    var SWIPE_MAX_DY_RATIO = 0.75;
    var VERTICAL_CANCEL_PX = 30;
    var startX = 0;
    var startY = 0;
    var tracking = false;

    function isIgnoredTarget(target) {
      var el = target;
      while (el && el !== form) {
        if (el.classList) {
          if (el.classList.contains('argus-tabs')) {
            return true;
          }
          if (el.classList.contains('argus-segment-radiogroup')) {
            return true;
          }
        }
        var tag = el.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' ||
            tag === 'A' || tag === 'BUTTON') {
          return true;
        }
        el = el.parentNode;
      }
      return false;
    }

    function currentTabIndex() {
      var active = tabsRoot.querySelector('.argus-tab.active');
      if (!active) {
        return 0;
      }
      var idx = TAB_GROUPS.indexOf(active.getAttribute('data-tab'));
      return idx >= 0 ? idx : 0;
    }

    form.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length !== 1 || isIgnoredTarget(e.target)) {
        tracking = false;
        return;
      }
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, false);

    form.addEventListener('touchmove', function (e) {
      if (!tracking || !e.touches || e.touches.length !== 1) {
        return;
      }
      var dx = Math.abs(e.touches[0].clientX - startX);
      var dy = Math.abs(e.touches[0].clientY - startY);
      if (dy > VERTICAL_CANCEL_PX && dy > dx) {
        tracking = false;
      }
    }, false);

    form.addEventListener('touchend', function (e) {
      if (!tracking) {
        return;
      }
      tracking = false;
      if (!e.changedTouches || !e.changedTouches.length) {
        return;
      }
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);
      if (absDx < SWIPE_MIN_DX || absDy > absDx * SWIPE_MAX_DY_RATIO) {
        return;
      }

      var idx = currentTabIndex();
      if (dx < 0 && idx < TAB_GROUPS.length - 1) {
        showTab(TAB_GROUPS[idx + 1], tabsRoot);
      } else if (dx > 0 && idx > 0) {
        showTab(TAB_GROUPS[idx - 1], tabsRoot);
      }
    }, false);

    form.addEventListener('touchcancel', function () {
      tracking = false;
    }, false);
  }

