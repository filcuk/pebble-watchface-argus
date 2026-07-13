var countries = require('./holiday-countries');
var subdivisions = require('./holiday-subdivisions');

var NAGER_API_BASE = 'https://date.nager.at/api/v4';
var HOLIDAY_CACHE_PREFIX = 'argus-holidays-v4:';
var SUPPORTED_COUNTRY_CODES = {};

countries.forEach(function (entry) {
  SUPPORTED_COUNTRY_CODES[entry.code] = true;
});

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
    if (/^[A-Z]{2}$/.test(region) && SUPPORTED_COUNTRY_CODES[region]) {
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
  if (mapped && SUPPORTED_COUNTRY_CODES[mapped]) {
    return mapped;
  }

  return '';
}

function isSupportedCountryCode(code) {
  return !!code && SUPPORTED_COUNTRY_CODES[code];
}

function getSubdivisionsForCountry(countryCode) {
  return subdivisions[countryCode] || [];
}

function countryHasSubdivisions(countryCode) {
  return getSubdivisionsForCountry(countryCode).length > 0;
}

function parseHolidayDate(dateStr) {
  var parts = dateStr.split('-');
  if (parts.length !== 3) {
    return null;
  }
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10) - 1,
    day: parseInt(parts[2], 10),
  };
}

function holidayApplies(holiday, regionCode) {
  if (!holiday || !holiday.holidayTypes || holiday.holidayTypes.indexOf('Public') === -1) {
    return false;
  }

  if (holiday.nationalHoliday) {
    return true;
  }

  if (!regionCode) {
    return false;
  }

  if (!holiday.subdivisionCodes || !holiday.subdivisionCodes.length) {
    return false;
  }

  return holiday.subdivisionCodes.indexOf(regionCode) !== -1;
}

function filterHolidayDates(holidays, regionCode) {
  var dates = [];
  filterHolidayEntries(holidays, regionCode).forEach(function (entry) {
    dates.push({
      year: entry.year,
      month: entry.month,
      day: entry.day,
    });
  });
  return dates;
}

function filterHolidayEntries(holidays, regionCode) {
  var entries = [];
  if (!holidays || !holidays.length) {
    return entries;
  }

  holidays.forEach(function (holiday) {
    if (!holidayApplies(holiday, regionCode)) {
      return;
    }
    var parsed = parseHolidayDate(holiday.date);
    if (!parsed) {
      return;
    }
    entries.push({
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      name: holiday.localName || holiday.name || 'Holiday',
      national: !!holiday.nationalHoliday,
    });
  });

  return entries;
}

function readCachedHolidaysForWindow(countryCode, now, weekStart) {
  if (!isSupportedCountryCode(countryCode)) {
    return [];
  }
  var windowDates = buildCalendarWindow(now || new Date(), weekStart || '0');
  var years = yearsForWindow(windowDates);
  var combined = [];
  years.forEach(function (year) {
    var cached = readHolidayCache(countryCode, year);
    if (cached && cached.length) {
      combined = combined.concat(cached);
    }
  });
  return combined;
}

function listHolidaysInCalendarWindow(holidays, regionCode, now, weekStart) {
  now = now || new Date();
  var windowDates = buildCalendarWindow(now, weekStart || '0');
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  var entries = filterHolidayEntries(holidays, regionCode);
  var result = [];

  entries.forEach(function (entry) {
    var candidate = new Date(entry.year, entry.month, entry.day, 12, 0, 0, 0);
    var i;
    for (i = 0; i < windowDates.length; i += 1) {
      if (sameCalendarDay(windowDates[i], candidate)) {
        result.push({
          name: entry.name,
          year: entry.year,
          month: entry.month,
          day: entry.day,
          national: entry.national,
          dateMs: candidate.getTime(),
          isPast: candidate.getTime() < today.getTime(),
        });
        break;
      }
    }
  });

  result.sort(function (a, b) {
    return a.dateMs - b.dateMs;
  });
  return result;
}

function daysSinceWeekStart(wday, weekStart) {
  var startWday = weekStart === '1' ? 0 : 1;
  return (wday - startWday + 7) % 7;
}

function buildCalendarWindow(now, weekStart) {
  var cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  var index = daysSinceWeekStart(cursor.getDay(), weekStart);
  cursor.setDate(cursor.getDate() - index);

  var cells = [];
  var i;
  for (i = 0; i < 14; i += 1) {
    cells.push(new Date(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function packHolidayMask(windowDates, holidayDates) {
  var mask = 0;
  var i;
  var j;

  for (i = 0; i < windowDates.length && i < 14; i += 1) {
    for (j = 0; j < holidayDates.length; j += 1) {
      var holidayDate = holidayDates[j];
      var candidate = new Date(holidayDate.year, holidayDate.month, holidayDate.day, 12, 0, 0, 0);
      if (sameCalendarDay(windowDates[i], candidate)) {
        mask |= 1 << i;
        break;
      }
    }
  }

  return mask;
}

function cacheKey(countryCode, year) {
  return HOLIDAY_CACHE_PREFIX + countryCode + ':' + year;
}

function readHolidayCache(countryCode, year) {
  try {
    var raw = localStorage.getItem(cacheKey(countryCode, year));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeHolidayCache(countryCode, year, holidays) {
  try {
    localStorage.setItem(cacheKey(countryCode, year), JSON.stringify(holidays));
  } catch (e) {
    // Ignore storage failures.
  }
}

function fetchHolidayYear(countryCode, year, xhrRequest, callback) {
  var cached = readHolidayCache(countryCode, year);
  if (cached) {
    callback(cached);
    return;
  }

  var url = NAGER_API_BASE + '/Holidays/' + encodeURIComponent(countryCode) + '/' + year;
  xhrRequest(url, function (responseText) {
    if (!responseText) {
      callback(null);
      return;
    }

    try {
      var holidays = JSON.parse(responseText);
      writeHolidayCache(countryCode, year, holidays);
      callback(holidays);
    } catch (e) {
      callback(null);
    }
  });
}

function yearsForWindow(windowDates) {
  var years = {};
  windowDates.forEach(function (date) {
    years[date.getFullYear()] = true;
  });
  return Object.keys(years).map(function (year) {
    return parseInt(year, 10);
  });
}

function fetchHolidaysForWindow(options, callback) {
  var countryCode = options.countryCode;
  var regionCode = options.regionCode || '';
  var weekStart = options.weekStart || '0';
  var now = options.now || new Date();
  var xhrRequest = options.xhrRequest;

  if (!isSupportedCountryCode(countryCode)) {
    callback({ mask: 0, holidays: [] });
    return;
  }

  var windowDates = buildCalendarWindow(now, weekStart);
  var years = yearsForWindow(windowDates);
  var pending = years.length;
  var combined = [];
  var hadError = false;

  if (!pending) {
    callback({ mask: 0, holidays: [] });
    return;
  }

  years.forEach(function (year) {
    fetchHolidayYear(countryCode, year, xhrRequest, function (holidays) {
      pending -= 1;
      if (holidays) {
        combined = combined.concat(holidays);
      } else {
        hadError = true;
      }

      if (pending > 0) {
        return;
      }

      if (hadError && !combined.length) {
        callback({ mask: 0, holidays: [] });
        return;
      }

      var holidayDates = filterHolidayDates(combined, regionCode);
      callback({
        mask: packHolidayMask(windowDates, holidayDates),
        holidays: holidayDates,
      });
    });
  });
}

module.exports = {
  countries: countries,
  subdivisions: subdivisions,
  detectLocaleCountryCode: detectLocaleCountryCode,
  isSupportedCountryCode: isSupportedCountryCode,
  getSubdivisionsForCountry: getSubdivisionsForCountry,
  countryHasSubdivisions: countryHasSubdivisions,
  holidayApplies: holidayApplies,
  filterHolidayDates: filterHolidayDates,
  filterHolidayEntries: filterHolidayEntries,
  listHolidaysInCalendarWindow: listHolidaysInCalendarWindow,
  readCachedHolidaysForWindow: readCachedHolidaysForWindow,
  buildCalendarWindow: buildCalendarWindow,
  packHolidayMask: packHolidayMask,
  fetchHolidaysForWindow: fetchHolidaysForWindow,
  readHolidayCache: readHolidayCache,
  writeHolidayCache: writeHolidayCache,
};
