#pragma once

#include <pebble.h>

#define SETTINGS_PERSIST_KEY 2
#define SETTINGS_PERSIST_VERSION 1

typedef enum {
  HOUR_FORMAT_SYSTEM = 0,
  HOUR_FORMAT_12H = 1,
  HOUR_FORMAT_24H = 2,
} HourFormat;

typedef enum {
  WEEK_START_MONDAY = 0,
  WEEK_START_SUNDAY = 1,
} WeekStart;

typedef enum {
  WEEK_NUMBER_ISO = 0,
  WEEK_NUMBER_GREGORIAN = 1,
} WeekNumberMode;

typedef enum {
  BT_DISPLAY_ALWAYS = 0,
  BT_DISPLAY_DISCONNECTED_ONLY = 1,
} BluetoothDisplay;

typedef enum {
  LOCATION_MODE_GPS = 0,
  LOCATION_MODE_MANUAL = 1,
} LocationMode;

typedef enum {
  HEADER_DISPLAY_FULL_DATE = 0,
  HEADER_DISPLAY_STEPS = 1,
  HEADER_DISPLAY_TEMP_RANGE = 2,
} HeaderDisplayMode;

typedef struct {
  uint8_t version;
  HourFormat hour_format;
  WeekStart week_start;
  WeekNumberMode week_number_mode;
  BluetoothDisplay bluetooth_display;
  LocationMode location_mode;
  HeaderDisplayMode header_display_mode;
  char manual_location[48];
  uint8_t forecast_hours;
  bool temperature_fahrenheit;
  bool show_event_indicators;
  bool debug_mode;
  bool demo_weather;
} ArgusSettings;

void settings_init(void);
const ArgusSettings *settings_get(void);
bool settings_show_calendar_month(void);
void settings_apply_from_message(DictionaryIterator *iter);
void settings_save(void);
