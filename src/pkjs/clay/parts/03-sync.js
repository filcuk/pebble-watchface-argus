  function syncDebugToggles() {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var demoWeatherToggle = clayConfig.getItemByMessageKey('DemoWeather');
    var demoBiometricsToggle = clayConfig.getItemByMessageKey('DemoBiometrics');
    var weatherLogToggle = clayConfig.getItemByMessageKey('DebugWeatherLog');
    var debugItems = [demoWeatherToggle, demoBiometricsToggle, weatherLogToggle];
    var i;

    if (!debugToggle) {
      return;
    }

    var debugOn = !!debugToggle.get();
    for (i = 0; i < debugItems.length; i += 1) {
      var item = debugItems[i];
      if (!item || !item.$element || !item.$element[0]) {
        continue;
      }
      if (debugOn) {
        item.$element[0].classList.remove('hide');
        item.enable();
      } else {
        item.set(false);
        item.$element[0].classList.add('hide');
        item.disable();
      }
    }

    syncWeatherDebugLogVisibility();
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

  function syncHeaderDependentVisibility() {
    var headerDisplay = clayConfig.getItemByMessageKey('HeaderDisplay');
    var fullDateFormat = clayConfig.getItemByMessageKey('FullDateFormat');
    var windUnit = clayConfig.getItemByMessageKey('WindUnit');
    var headerValue = headerDisplay ? headerDisplay.get() : null;

    if (fullDateFormat && fullDateFormat.$element && fullDateFormat.$element[0]) {
      if (headerValue === '0') {
        fullDateFormat.$element[0].classList.remove('hide');
      } else {
        fullDateFormat.$element[0].classList.add('hide');
      }
    }

    if (windUnit && windUnit.$element && windUnit.$element[0]) {
      if (headerValue === '4') {
        windUnit.$element[0].classList.remove('hide');
      } else {
        windUnit.$element[0].classList.add('hide');
      }
    }
  }

  function persistClaySetting(key, value) {
    try {
      if (typeof window !== 'undefined') {
        window.claySettings = window.claySettings || {};
        window.claySettings[key] = value;
      }
      var stored = JSON.parse(localStorage.getItem('clay-settings')) || {};
      stored[key] = value;
      localStorage.setItem('clay-settings', JSON.stringify(stored));
    } catch (e) {
      // Ignore localStorage errors in the config page.
    }
  }

  function readClaySetting(key) {
    try {
      if (typeof window !== 'undefined' && window.claySettings && window.claySettings[key] !== undefined) {
        return normalizeClayValue(window.claySettings[key]);
      }
    } catch (e) {
      // Ignore access errors in the config page.
    }

    return readStoredClaySetting(key);
  }

  function readStoredClaySetting(key) {
    try {
      var stored = JSON.parse(localStorage.getItem('clay-settings')) || {};
      var value = stored[key];
      if (value === undefined || value === null) {
        return '';
      }
      if (value && typeof value === 'object' && 'value' in value) {
        return value.value;
      }
      return value;
    } catch (e) {
      return '';
    }
  }

  function getHolidayCountryValue(countryItem) {
    var value = normalizeClayValue(countryItem ? countryItem.get() : '');
    if (value) {
      return value;
    }

    if (countryItem && countryItem.$element && countryItem.$element[0]) {
      var select = countryItem.$element[0].querySelector('select.argus-holiday-select');
      if (select && select.value) {
        return select.value;
      }
    }

    return readClaySetting('HolidayCountry') || '';
  }

  function getHolidayRegionValue(regionItem) {
    var stored = readClaySetting('HolidayRegion');
    if (stored) {
      return stored;
    }
    return normalizeClayValue(regionItem ? regionItem.get() : '');
  }

  function applyHolidayRegionSelection(regionItem, selectedRegion) {
    if (!regionItem || !regionItem.$element || !regionItem.$element[0]) {
      return;
    }

    var radioGroup = regionItem.$element[0].querySelector('.radio-group');
    if (radioGroup) {
      var inputs = radioGroup.querySelectorAll('input[type="radio"]');
      var i;
      for (i = 0; i < inputs.length; i += 1) {
        inputs[i].checked = inputs[i].value === selectedRegion;
      }
    }

    regionItem.set(selectedRegion);
    syncRadioLabels('HolidayRegion');
  }

  function ensureHolidayRegionItemValue(regionItem, selectedRegion) {
    if (!regionItem) {
      return selectedRegion || '';
    }
    var value = selectedRegion || getHolidayRegionValue(regionItem);
    if (normalizeClayValue(regionItem.get()) !== value) {
      applyHolidayRegionSelection(regionItem, value);
    }
    return value || '';
  }

  function ensureHolidayCountryItemValue(countryItem) {
    var value = getHolidayCountryValue(countryItem);
    if (!value || !countryItem) {
      return value || '';
    }
    if (normalizeClayValue(countryItem.get()) !== value) {
      countryItem.set(value);
    }
    return value;
  }

  function normalizeClayValue(value) {
    if (value && typeof value === 'object' && 'value' in value) {
      return value.value;
    }
    return value || '';
  }

  function populateSelectOptions(select, options, selectedValue) {
    select.innerHTML = '';
    options.forEach(function (option) {
      var node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    });
    select.value = selectedValue || '';
  }

  function getHolidayCountrySelectOptions() {
    return holidayCountryOptions;
  }

  function getSelectOptionsForKey(key, item) {
    if (key === 'HolidayCountry') {
      return getHolidayCountrySelectOptions();
    }
    return item.config.options || [];
  }

  function ensureSelectDropdown(key) {
    var item = clayConfig.getItemByMessageKey(key);
    if (!item || !item.$element || !item.$element[0]) {
      return null;
    }

    var root = item.$element[0];
    if (key === 'HolidayCountry') {
      root.classList.add('argus-holiday-dropdown');
    }

    var radioGroup = root.querySelector('.radio-group');
    if (radioGroup) {
      radioGroup.classList.add('hide');
    }

    var select = root.querySelector('select.argus-holiday-select');
    if (!select) {
      select = document.createElement('select');
      select.className = 'argus-holiday-select';

      var desc = root.querySelector(':scope > .description');
      if (desc && !root.querySelector(':scope > .argus-control-row')) {
        var row = document.createElement('div');
        row.className = 'argus-control-row';
        root.insertBefore(row, desc);
        row.appendChild(desc);
        row.appendChild(select);
      } else {
        root.appendChild(select);
      }

      select.addEventListener('change', function () {
        item.set(select.value);
        persistClaySetting(key, select.value);
      });
    }

    populateSelectOptions(select, getSelectOptionsForKey(key, item), normalizeClayValue(item.get()));
    return select;
  }

  function convertSelectDropdowns() {
    SELECT_DROPDOWN_KEYS.forEach(ensureSelectDropdown);
  }

  function syncHolidayDropdownValue(key) {
    var item = clayConfig.getItemByMessageKey(key);
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var select = item.$element[0].querySelector('select.argus-holiday-select');
    if (select) {
      select.value = normalizeClayValue(item.get());
    }
  }

  function rebuildRegionOptions(countryCode, selectedRegion, done) {
    var regionItem = clayConfig.getItemByMessageKey('HolidayRegion');
    if (!regionItem || !regionItem.$element || !regionItem.$element[0]) {
      if (done) {
        done();
      }
      return;
    }

    if (!countryCode) {
      if (done) {
        done();
      }
      return;
    }

    loadSubdivisionsForCountry(countryCode, function (subdivisions) {
      var options = [{ label: 'National only', value: '' }];
      subdivisions.forEach(function (entry) {
        options.push({ label: entry.name, value: entry.code });
      });

      var validValues = {};
      options.forEach(function (option) {
        validValues[option.value] = true;
      });
      if (!validValues[selectedRegion]) {
        if (selectedRegion) {
          // Subdivisions are loaded for this country; stored region is no longer valid.
          persistClaySetting('HolidayRegion', '');
        }
        selectedRegion = '';
      }

      regionItem.config.options = options;

      var radioGroup = regionItem.$element[0].querySelector('.radio-group');
      if (!radioGroup) {
        if (done) {
          done();
        }
        return;
      }

      var clayId = regionItem.config.clayId;
      radioGroup.innerHTML = '';
      options.forEach(function (option) {
        var label = document.createElement('label');
        label.className = 'tap-highlight';
        if (option.value === selectedRegion) {
          label.classList.add('active');
        }

        var span = document.createElement('span');
        span.className = 'label';
        span.textContent = option.label;

        var input = document.createElement('input');
        input.type = 'radio';
        input.value = option.value;
        input.name = 'clay-' + clayId;
        if (option.value === selectedRegion) {
          input.checked = true;
        }

        var icon = document.createElement('i');

        label.appendChild(span);
        label.appendChild(input);
        label.appendChild(icon);
        radioGroup.appendChild(label);
      });

      applyHolidayRegionSelection(regionItem, selectedRegion);
      if (done) {
        done();
      }
    });
  }

  function resolveHolidayDefaults() {
    var countryItem = clayConfig.getItemByMessageKey('HolidayCountry');
    if (!countryItem) {
      return;
    }

    var country = getHolidayCountryValue(countryItem);
    if (!country) {
      var detected = detectLocaleCountryCode();
      if (detected) {
        countryItem.set(detected);
        persistClaySetting('HolidayCountry', detected);
      }
    } else {
      ensureHolidayCountryItemValue(countryItem);
    }

    syncHolidayDropdownValue('HolidayCountry');
  }

  function syncHolidayRegionVisibility(country, regionItem) {
    if (!regionItem || !regionItem.$element || !regionItem.$element[0]) {
      return;
    }

    if (!country) {
      return;
    }

    var showRegion = countryHasSubdivisions(country);
    if (showRegion) {
      regionItem.$element[0].classList.remove('hide');
      regionItem.enable();
    } else {
      regionItem.$element[0].classList.add('hide');
      regionItem.disable();
      regionItem.set('');
      persistClaySetting('HolidayRegion', '');
    }
  }

  function syncHolidaySettings(done) {
    var showHolidays = clayConfig.getItemByMessageKey('ShowHolidays');
    var countryItem = clayConfig.getItemByMessageKey('HolidayCountry');
    var regionItem = clayConfig.getItemByMessageKey('HolidayRegion');

    if (!showHolidays || !countryItem || !regionItem) {
      if (done) {
        done();
      }
      return;
    }

    var enabled = !!showHolidays.get();
    var country = ensureHolidayCountryItemValue(countryItem);

    if (enabled) {
      countryItem.$element[0].classList.remove('hide');
      countryItem.enable();
    } else {
      countryItem.$element[0].classList.add('hide');
      countryItem.disable();
      if (regionItem.$element && regionItem.$element[0]) {
        regionItem.$element[0].classList.add('hide');
      }
      regionItem.disable();
    }

    if (!enabled) {
      if (done) {
        done();
      }
      return;
    }

    var region = getHolidayRegionValue(regionItem);

    rebuildRegionOptions(country, region || '', function () {
      syncHolidayRegionVisibility(country, regionItem);
      ensureHolidayRegionItemValue(regionItem, region || '');
      if (done) {
        done();
      }
    });
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
        if (key === 'HolidayRegion') {
          persistClaySetting('HolidayRegion', normalizeClayValue(item.get()));
        }
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

  var saveBaseline = null;
  var saveTrackingReady = false;
  var saveTrackingPaused = false;

  function canonicalizeSettingValue(value) {
    var normalized = normalizeClayValue(value);
    if (normalized === true) {
      return 'true';
    }
    if (normalized === false) {
      return 'false';
    }
    if (normalized === null || normalized === undefined) {
      return '';
    }
    return String(normalized);
  }

  function getTrackedSettingItems() {
    return clayConfig.getAllItems().filter(function (item) {
      return !!item.messageKey;
    });
  }

  function captureSaveBaseline() {
    saveBaseline = {};
    getTrackedSettingItems().forEach(function (item) {
      saveBaseline[item.messageKey] = canonicalizeSettingValue(item.get());
    });
    saveTrackingReady = true;
  }

  function countChangedSettings() {
    if (!saveBaseline) {
      return 0;
    }

    var count = 0;
    getTrackedSettingItems().forEach(function (item) {
      var current = canonicalizeSettingValue(item.get());
      var baseline = saveBaseline[item.messageKey];
      if (baseline === undefined) {
        baseline = '';
      }
      if (current !== baseline) {
        count += 1;
      }
    });
    return count;
  }

  function updateSaveButtonLabel() {
    if (!saveTrackingReady || saveTrackingPaused) {
      return;
    }

    var submitItems = clayConfig.getItemsByType('submit');
    if (!submitItems.length) {
      return;
    }

    var count = countChangedSettings();
    var label = count > 0 ? 'Save (' + count + ')' : 'Save';
    if (submitItems[0].get() !== label) {
      submitItems[0].set(label);
    }
  }

  function refreshSaveBaselineKeys(keys) {
    if (!saveBaseline) {
      return;
    }

    keys.forEach(function (key) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item) {
        saveBaseline[key] = canonicalizeSettingValue(item.get());
      }
    });
    updateSaveButtonLabel();
  }

  function bindSaveChangeTracking() {
    getTrackedSettingItems().forEach(function (item) {
      item.on('change', updateSaveButtonLabel);
      if (
        item.config.type === 'input' &&
        item.$manipulatorTarget &&
        item.$manipulatorTarget[0]
      ) {
        item.$manipulatorTarget[0].addEventListener('input', updateSaveButtonLabel);
      }
    });

    captureSaveBaseline();
    updateSaveButtonLabel();
  }

