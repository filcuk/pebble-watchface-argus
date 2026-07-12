  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var locationMode = clayConfig.getItemByMessageKey('LocationMode');

    var tabsRoot = injectTabs();
    injectFooter();
    applyRowStyles();
    wrapTabPanels();
    loadSubdivisionCatalogFromConfig();
    convertSelectDropdowns();
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

    loadHolidayCountries(function () {
      refreshHolidayCountryDropdown();
      resolveHolidayDefaults();
      syncHolidaySettings();
    });

    var showHolidays = clayConfig.getItemByMessageKey('ShowHolidays');
    var holidayCountry = clayConfig.getItemByMessageKey('HolidayCountry');
    if (showHolidays) {
      showHolidays.on('change', syncHolidaySettings);
    }
    if (holidayCountry) {
      holidayCountry.on('change', syncHolidaySettings);
    }

    injectTheme();
  });

