  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var locationMode = clayConfig.getItemByMessageKey('LocationMode');

    var tabsRoot = injectTabs();
    injectFooter();
    applyRowStyles();
    injectSplitListRadiogroupHelp();
    wrapTabPanels();
    loadSubdivisionCatalogFromConfig();
    convertSelectDropdowns();
    wrapInlineControlBodies();
    hideHeaderHeartRateIfNeeded();
    injectHeaderDisplayIcons();
    normalizeRealtimeStepsDefault();

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
      bindTabSwipe(tabsRoot);
      showTab('tabAbout', tabsRoot);
    }

    syncDebugToggles();
    syncWeatherDebugLogVisibility();
    if (debugToggle) {
      debugToggle.on('change', syncDebugToggles);
    }

    var weatherLogToggle = clayConfig.getItemByMessageKey('DebugWeatherLog');
    if (weatherLogToggle) {
      weatherLogToggle.on('change', syncWeatherDebugLogVisibility);
    }

    syncManualLocationInput();
    if (locationMode) {
      locationMode.on('change', syncManualLocationInput);
    }

    syncHeaderDependentVisibility();
    var headerDisplay = clayConfig.getItemByMessageKey('HeaderDisplay');
    if (headerDisplay) {
      headerDisplay.on('change', syncHeaderDependentVisibility);
    }

    bindSaveChangeTracking();

    saveTrackingPaused = true;
    loadHolidayCountries(function () {
      refreshHolidayCountryDropdown();
      resolveHolidayDefaults();
      syncHolidaySettings(function () {
        bindSegmentSync();
        // Holiday defaults may set country/region after open; don't count those.
        refreshSaveBaselineKeys(['HolidayCountry', 'HolidayRegion']);
        saveTrackingPaused = false;
        updateSaveButtonLabel();
      });
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

