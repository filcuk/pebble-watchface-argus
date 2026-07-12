function loadSubdivisionCatalogFromConfig() {
    holidaySubdivisionsCatalog = {};
    subdivisionNameLookup = {};

    var item = clayConfig.getItemById('argus-holiday-subdivisions-data');
    var encoded = item ? String(item.get() || '') : '';
    if (!encoded) {
      return;
    }

    encoded.split('\x1d').forEach(function (part) {
      var colon = part.indexOf(':');
      if (colon < 0) {
        return;
      }
      var countryCode = part.slice(0, colon);
      var regions = [];

      part.slice(colon + 1).split('\x1e').forEach(function (regionPart) {
        var sep = regionPart.indexOf('\x1f');
        if (sep < 0) {
          return;
        }
        var code = regionPart.slice(0, sep);
        var name = regionPart.slice(sep + 1);
        regions.push({ code: code, name: name });
        subdivisionNameLookup[code] = name;
      });

      holidaySubdivisionsCatalog[countryCode] = regions;
    });
  }

  function xhrGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function () {
      callback(xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : null);
    };
    xhr.onerror = function () {
      callback(null);
    };
    xhr.send();
  }

  function applyHolidayCountries(countries) {
    holidayCountryOptions = [{ label: 'Select country', value: '' }];
    supportedCountryCodes = {};

    countries.forEach(function (entry) {
      if (!entry || !entry.code) {
        return;
      }
      supportedCountryCodes[entry.code] = true;
      holidayCountryOptions.push({
        label: entry.name || entry.code,
        value: entry.code,
      });
    });
  }

  function readCachedHolidayCountries() {
    try {
      var raw = localStorage.getItem(CLAY_COUNTRIES_CACHE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeCachedHolidayCountries(countries) {
    try {
      localStorage.setItem(CLAY_COUNTRIES_CACHE_KEY, JSON.stringify(countries));
    } catch (e) {
      // Ignore storage failures in the config page.
    }
  }

  function loadHolidayCountries(callback) {
    var cached = readCachedHolidayCountries();
    if (cached && cached.length) {
      applyHolidayCountries(cached);
      callback(true);
      return;
    }

    xhrGet(NAGER_API_BASE + '/v3/AvailableCountries', function (responseText) {
      if (!responseText) {
        holidayCountryOptions = [{ label: 'Select country', value: '' }];
        callback(false);
        return;
      }

      try {
        var raw = JSON.parse(responseText);
        var countries = raw.map(function (entry) {
          return {
            code: entry.countryCode,
            name: entry.name,
          };
        }).sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
        writeCachedHolidayCountries(countries);
        applyHolidayCountries(countries);
        callback(true);
      } catch (e) {
        holidayCountryOptions = [{ label: 'Select country', value: '' }];
        callback(false);
      }
    });
  }

  function subdivisionDisplayName(code) {
    if (subdivisionNameLookup[code]) {
      return subdivisionNameLookup[code];
    }

    var parts = code.split('-');
    if (parts.length >= 2 && typeof Intl !== 'undefined' && Intl.DisplayNames) {
      try {
        var displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
        var name = displayNames.of(parts[parts.length - 1]);
        if (name && name !== parts[parts.length - 1]) {
          return name;
        }
      } catch (e) {
        // Fall back to the raw subdivision code.
      }
    }
    return code;
  }

  function readCachedSubdivisions(countryCode) {
    try {
      var raw = localStorage.getItem(CLAY_SUBDIVISIONS_CACHE_PREFIX + countryCode);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeCachedSubdivisions(countryCode, subdivisions) {
    try {
      localStorage.setItem(
        CLAY_SUBDIVISIONS_CACHE_PREFIX + countryCode,
        JSON.stringify(subdivisions)
      );
    } catch (e) {
      // Ignore storage failures in the config page.
    }
  }

  function extractSubdivisionsFromHolidays(holidays) {
    var regions = [];
    var seen = {};

    if (!holidays || !holidays.length) {
      return regions;
    }

    holidays.forEach(function (holiday) {
      if (!holiday || !holiday.subdivisionCodes || !holiday.subdivisionCodes.length) {
        return;
      }
      holiday.subdivisionCodes.forEach(function (code) {
        if (seen[code]) {
          return;
        }
        seen[code] = true;
        regions.push({
          code: code,
          name: subdivisionDisplayName(code),
        });
      });
    });

    regions.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    return regions;
  }

  function loadSubdivisionsForCountry(countryCode, callback) {
    if (!countryCode) {
      holidaySubdivisions[countryCode] = [];
      callback([]);
      return;
    }

    if (holidaySubdivisionsCatalog[countryCode] && holidaySubdivisionsCatalog[countryCode].length) {
      var catalogRegions = holidaySubdivisionsCatalog[countryCode].slice();
      holidaySubdivisions[countryCode] = catalogRegions;
      callback(catalogRegions);
      return;
    }

    var cached = readCachedSubdivisions(countryCode);
    if (cached) {
      holidaySubdivisions[countryCode] = cached;
      callback(cached);
      return;
    }

    var year = new Date().getFullYear();
    xhrGet(
      NAGER_API_BASE + '/v4/Holidays/' + encodeURIComponent(countryCode) + '/' + year,
      function (responseText) {
        var regions = [];
        if (responseText) {
          try {
            regions = extractSubdivisionsFromHolidays(JSON.parse(responseText));
          } catch (e) {
            regions = [];
          }
        }
        holidaySubdivisions[countryCode] = regions;
        writeCachedSubdivisions(countryCode, regions);
        callback(regions);
      }
    );
  }

  function refreshHolidayCountryDropdown() {
    var item = clayConfig.getItemByMessageKey('HolidayCountry');
    if (!item || !item.$element || !item.$element[0]) {
      return;
    }

    var select = item.$element[0].querySelector('select.argus-holiday-select');
    if (!select) {
      return;
    }

    var value = ensureHolidayCountryItemValue(item);
    populateSelectOptions(
      select,
      getHolidayCountrySelectOptions(),
      value
    );
  }

  function detectLocaleCountryCode() {
    var lang = '';
    if (typeof navigator !== 'undefined') {
      lang = navigator.language || navigator.userLanguage || '';
    }
    if (!lang) {
      return '';
    }

    var parts = lang.replace('_', '-').split('-');
    if (parts.length >= 2) {
      var region = parts[parts.length - 1].toUpperCase();
      if (/^[A-Z]{2}$/.test(region) && supportedCountryCodes[region]) {
        return region;
      }
    }

    var language = parts[0].toLowerCase();
    var languageMap = {
      de: 'DE',
      en: 'GB',
      es: 'ES',
      fr: 'FR',
      it: 'IT',
      ja: 'JP',
      nl: 'NL',
      pl: 'PL',
      pt: 'PT',
      sv: 'SE',
    };
    var mapped = languageMap[language];
    if (mapped && supportedCountryCodes[mapped]) {
      return mapped;
    }

    return '';
  }

  function getSubdivisionsForCountry(countryCode) {
    return holidaySubdivisions[countryCode] || [];
  }

  function countryHasSubdivisions(countryCode) {
    if (holidaySubdivisionsCatalog[countryCode] && holidaySubdivisionsCatalog[countryCode].length) {
      return true;
    }
    return getSubdivisionsForCountry(countryCode).length > 0;
  }

