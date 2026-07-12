  function syncDebugToggles() {
    var debugToggle = clayConfig.getItemByMessageKey('DebugMode');
    var demoWeatherToggle = clayConfig.getItemByMessageKey('DemoWeather');
    var demoBiometricsToggle = clayConfig.getItemByMessageKey('DemoBiometrics');
    var releaseNotification = clayConfig.getItemByMessageKey('ReleaseNotification');

    if (!debugToggle || !demoWeatherToggle || !demoBiometricsToggle || !releaseNotification) {
      return;
    }

    if (debugToggle.get()) {
      demoWeatherToggle.enable();
      demoBiometricsToggle.enable();
      releaseNotification.enable();
    } else {
      demoWeatherToggle.set(false);
      demoWeatherToggle.disable();
      demoBiometricsToggle.set(false);
      demoBiometricsToggle.disable();
      releaseNotification.set('0');
      syncHolidayDropdownValue('ReleaseNotification');
      releaseNotification.disable();
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

  function persistClaySetting(key, value) {
    try {
      var stored = JSON.parse(localStorage.getItem('clay-settings')) || {};
      stored[key] = value;
      localStorage.setItem('clay-settings', JSON.stringify(stored));
    } catch (e) {
      // Ignore localStorage errors in the config page.
    }
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

    return readStoredClaySetting('HolidayCountry') || '';
  }

  function getHolidayRegionValue(regionItem) {
    var value = normalizeClayValue(regionItem ? regionItem.get() : '');
    if (value) {
      return value;
    }
    return readStoredClaySetting('HolidayRegion') || '';
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

      regionItem.set(selectedRegion);
      syncRadioLabels('HolidayRegion');
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

    var showRegion = country && countryHasSubdivisions(country);
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

  function syncHolidaySettings() {
    var showHolidays = clayConfig.getItemByMessageKey('ShowHolidays');
    var countryItem = clayConfig.getItemByMessageKey('HolidayCountry');
    var regionItem = clayConfig.getItemByMessageKey('HolidayRegion');

    if (!showHolidays || !countryItem || !regionItem) {
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
      return;
    }

    var region = getHolidayRegionValue(regionItem);

    rebuildRegionOptions(country || '', region || '', function () {
      syncHolidayRegionVisibility(country, regionItem);
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

