#pragma once

#include <pebble.h>

#define SETTINGS_PERSIST_KEY 2
#define SETTINGS_PERSIST_VERSION 8

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
  TEMPERATURE_DISPLAY_ACTUAL = 0,
  TEMPERATURE_DISPLAY_FEELS = 1,
} TemperatureDisplay;

typedef enum {
  HEADER_DISPLAY_FULL_DATE = 0,
  HEADER_DISPLAY_STEPS = 1,
  HEADER_DISPLAY_TEMP_RANGE = 2,
  HEADER_DISPLAY_HEART_RATE = 3,
} HeaderDisplayMode;

typedef enum {
  CLOCK_FONT_LECO = 0,
  CLOCK_FONT_ROBOTO = 1,
  CLOCK_FONT_BITHAM_BOLD = 2,
  CLOCK_FONT_BITHAM_MEDIUM = 3,
} ClockFont;

typedef enum {
  BIOMETRIC_UPDATE_OPTIMISED = 0,
  BIOMETRIC_UPDATE_EVERY_MINUTE = 1,
  BIOMETRIC_UPDATE_LIVE = 2,
} BiometricUpdateMode;

typedef enum {
  WEATHER_UPDATE_INTERVAL_5_MIN = 5,
  WEATHER_UPDATE_INTERVAL_15_MIN = 15,
  WEATHER_UPDATE_INTERVAL_30_MIN = 30,
  WEATHER_UPDATE_INTERVAL_60_MIN = 60,
  WEATHER_UPDATE_INTERVAL_120_MIN = 120,
  WEATHER_UPDATE_INTERVAL_180_MIN = 180,
} WeatherUpdateInterval;

typedef struct {
  uint8_t version;
  HourFormat hour_format;
  ClockFont clock_font;
  WeekStart week_start;
  WeekNumberMode week_number_mode;
  BluetoothDisplay bluetooth_display;
  LocationMode location_mode;
  HeaderDisplayMode header_display_mode;
  char manual_location[48];
  uint8_t forecast_hours;
  bool temperature_fahrenheit;
  TemperatureDisplay temperature_display;
  bool show_event_indicators;
  bool debug_mode;
  bool demo_weather;
  bool demo_biometrics;
  BiometricUpdateMode biometric_update_mode;
  bool pause_weather_at_night;
  uint8_t weather_update_interval_min;
  bool quiet_mode_display;
} ArgusSettings;

void settings_init(void);
const ArgusSettings *settings_get(void);
bool settings_show_calendar_month(void);
bool settings_header_shows_biometrics(void);
bool settings_use_demo_biometrics(void);
void settings_apply_from_message(DictionaryIterator *iter);
void settings_save(void);
