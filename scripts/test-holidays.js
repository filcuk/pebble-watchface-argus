var assert = require('assert');
var holidays = require('../src/pkjs/holidays');

function testHolidayAppliesNationalOnly() {
  var holiday = {
    date: '2026-01-01',
    nationalHoliday: true,
    subdivisionCodes: null,
    holidayTypes: ['Public'],
  };
  assert.strictEqual(holidays.holidayApplies(holiday, ''), true);
  assert.strictEqual(holidays.holidayApplies(holiday, 'DE-BY'), true);
}

function testHolidayAppliesRegional() {
  var holiday = {
    date: '2026-01-06',
    nationalHoliday: false,
    subdivisionCodes: ['DE-BW', 'DE-BY'],
    holidayTypes: ['Public'],
  };
  assert.strictEqual(holidays.holidayApplies(holiday, ''), false);
  assert.strictEqual(holidays.holidayApplies(holiday, 'DE-BW'), true);
  assert.strictEqual(holidays.holidayApplies(holiday, 'DE-HH'), false);
}

function testPackHolidayMaskWeekStartMonday() {
  var now = new Date(2026, 0, 7, 12, 0, 0, 0);
  var windowDates = holidays.buildCalendarWindow(now, '0');
  assert.strictEqual(windowDates.length, 14);
  assert.strictEqual(windowDates[0].getDate(), 5);
  assert.strictEqual(windowDates[6].getDate(), 11);

  var mask = holidays.packHolidayMask(windowDates, [{ year: 2026, month: 0, day: 11 }]);
  assert.strictEqual(mask, 1 << 6);
}

function testPackHolidayMaskYearBoundary() {
  var now = new Date(2025, 11, 29, 12, 0, 0, 0);
  var windowDates = holidays.buildCalendarWindow(now, '0');
  var mask = holidays.packHolidayMask(windowDates, [
    { year: 2025, month: 11, day: 31 },
    { year: 2026, month: 0, day: 1 },
  ]);
  assert.notStrictEqual(mask, 0);
}

function testDetectLocaleCountry() {
  var previous = global.navigator;
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: { language: 'de-DE' },
  });
  assert.strictEqual(holidays.detectLocaleCountryCode(), 'DE');
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: previous,
  });
}

function testDetectLocaleCountryUnsupported() {
  var previous = global.navigator;
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: { language: 'xx-YY' },
  });
  assert.strictEqual(holidays.detectLocaleCountryCode(), '');
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: previous,
  });
}

function testFilterHolidayDatesNoCountry() {
  var dates = holidays.filterHolidayDates([
    {
      date: '2026-01-01',
      nationalHoliday: true,
      subdivisionCodes: null,
      holidayTypes: ['Public'],
    },
  ], '');
  assert.strictEqual(dates.length, 1);
}

function run() {
  testHolidayAppliesNationalOnly();
  testHolidayAppliesRegional();
  testPackHolidayMaskWeekStartMonday();
  testPackHolidayMaskYearBoundary();
  testDetectLocaleCountry();
  testDetectLocaleCountryUnsupported();
  testFilterHolidayDatesNoCountry();
  console.log('holiday tests passed');
}

run();
