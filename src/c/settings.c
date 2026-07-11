#include "settings.h"

#include <stdlib.h>
#include <string.h>

static ArgusSettings s_settings;

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
  TemperatureDisplay temperature_display;
  bool show_event_indicators;
  bool debug_mode;
  bool demo_weather;
} ArgusSettingsV2;

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
} ArgusSettingsV3;

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
  bool realtime_steps;
} ArgusSettingsV4;

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
  BiometricUpdateMode biometric_update_mode;
} ArgusSettingsV5;

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
} ArgusSettingsV6;

static void settings_set_defaults(void) {
  s_settings.version = SETTINGS_PERSIST_VERSION;
  s_settings.hour_format = HOUR_FORMAT_SYSTEM;
  s_settings.clock_font = CLOCK_FONT_LECO;
  s_settings.week_start = WEEK_START_MONDAY;
  s_settings.week_number_mode = WEEK_NUMBER_ISO;
  s_settings.bluetooth_display = BT_DISPLAY_DISCONNECTED_ONLY;
  s_settings.location_mode = LOCATION_MODE_GPS;
  s_settings.header_display_mode = HEADER_DISPLAY_FULL_DATE;
  s_settings.manual_location[0] = '\0';
  s_settings.forecast_hours = 24;
  s_settings.temperature_fahrenheit = false;
  s_settings.temperature_display = TEMPERATURE_DISPLAY_ACTUAL;
  s_settings.show_event_indicators = false;
  s_settings.debug_mode = false;
  s_settings.demo_weather = false;
  s_settings.demo_biometrics = false;
  s_settings.biometric_update_mode = BIOMETRIC_UPDATE_OPTIMISED;
  s_settings.pause_weather_at_night = false;
  s_settings.weather_update_interval_min = WEATHER_UPDATE_INTERVAL_30_MIN;
}

static bool settings_is_valid_weather_update_interval(uint8_t minutes) {
  return minutes == WEATHER_UPDATE_INTERVAL_5_MIN || minutes == WEATHER_UPDATE_INTERVAL_15_MIN ||
         minutes == WEATHER_UPDATE_INTERVAL_30_MIN || minutes == WEATHER_UPDATE_INTERVAL_60_MIN;
}

static void settings_validate(void) {
  if (s_settings.header_display_mode > HEADER_DISPLAY_HEART_RATE) {
    s_settings.header_display_mode = HEADER_DISPLAY_FULL_DATE;
  }
  if (s_settings.week_start != WEEK_START_MONDAY && s_settings.week_start != WEEK_START_SUNDAY) {
    s_settings.week_start = WEEK_START_MONDAY;
  }
  if (s_settings.week_number_mode > WEEK_NUMBER_GREGORIAN) {
    s_settings.week_number_mode = WEEK_NUMBER_ISO;
  }
  if (s_settings.temperature_display > TEMPERATURE_DISPLAY_FEELS) {
    s_settings.temperature_display = TEMPERATURE_DISPLAY_ACTUAL;
  }
  if (s_settings.clock_font > CLOCK_FONT_BITHAM_MEDIUM) {
    s_settings.clock_font = CLOCK_FONT_LECO;
  }
  if (s_settings.biometric_update_mode > BIOMETRIC_UPDATE_LIVE) {
    s_settings.biometric_update_mode = BIOMETRIC_UPDATE_OPTIMISED;
  }
  if (!settings_is_valid_weather_update_interval(s_settings.weather_update_interval_min)) {
    s_settings.weather_update_interval_min = WEATHER_UPDATE_INTERVAL_30_MIN;
  }
}

static void settings_migrate_from_v2(const ArgusSettingsV2 *legacy) {
  settings_set_defaults();
  s_settings.hour_format = legacy->hour_format;
  s_settings.week_start = legacy->week_start;
  s_settings.week_number_mode = legacy->week_number_mode;
  s_settings.bluetooth_display = legacy->bluetooth_display;
  s_settings.location_mode = legacy->location_mode;
  s_settings.header_display_mode = legacy->header_display_mode;
  strncpy(s_settings.manual_location, legacy->manual_location, sizeof(s_settings.manual_location) - 1);
  s_settings.manual_location[sizeof(s_settings.manual_location) - 1] = '\0';
  s_settings.forecast_hours = legacy->forecast_hours;
  s_settings.temperature_fahrenheit = legacy->temperature_fahrenheit;
  s_settings.temperature_display = legacy->temperature_display;
  s_settings.show_event_indicators = legacy->show_event_indicators;
  s_settings.debug_mode = legacy->debug_mode;
  s_settings.demo_weather = legacy->demo_weather;
  s_settings.version = SETTINGS_PERSIST_VERSION;
}

static void settings_migrate_from_v3(const ArgusSettingsV3 *legacy) {
  settings_set_defaults();
  s_settings.hour_format = legacy->hour_format;
  s_settings.clock_font = legacy->clock_font;
  s_settings.week_start = legacy->week_start;
  s_settings.week_number_mode = legacy->week_number_mode;
  s_settings.bluetooth_display = legacy->bluetooth_display;
  s_settings.location_mode = legacy->location_mode;
  s_settings.header_display_mode = legacy->header_display_mode;
  strncpy(s_settings.manual_location, legacy->manual_location, sizeof(s_settings.manual_location) - 1);
  s_settings.manual_location[sizeof(s_settings.manual_location) - 1] = '\0';
  s_settings.forecast_hours = legacy->forecast_hours;
  s_settings.temperature_fahrenheit = legacy->temperature_fahrenheit;
  s_settings.temperature_display = legacy->temperature_display;
  s_settings.show_event_indicators = legacy->show_event_indicators;
  s_settings.debug_mode = legacy->debug_mode;
  s_settings.demo_weather = legacy->demo_weather;
  s_settings.version = SETTINGS_PERSIST_VERSION;
}

static void settings_migrate_from_v4(const ArgusSettingsV4 *legacy) {
  settings_set_defaults();
  s_settings.hour_format = legacy->hour_format;
  s_settings.clock_font = legacy->clock_font;
  s_settings.week_start = legacy->week_start;
  s_settings.week_number_mode = legacy->week_number_mode;
  s_settings.bluetooth_display = legacy->bluetooth_display;
  s_settings.location_mode = legacy->location_mode;
  s_settings.header_display_mode = legacy->header_display_mode;
  strncpy(s_settings.manual_location, legacy->manual_location, sizeof(s_settings.manual_location) - 1);
  s_settings.manual_location[sizeof(s_settings.manual_location) - 1] = '\0';
  s_settings.forecast_hours = legacy->forecast_hours;
  s_settings.temperature_fahrenheit = legacy->temperature_fahrenheit;
  s_settings.temperature_display = legacy->temperature_display;
  s_settings.show_event_indicators = legacy->show_event_indicators;
  s_settings.debug_mode = legacy->debug_mode;
  s_settings.demo_weather = legacy->demo_weather;
  s_settings.biometric_update_mode =
      legacy->realtime_steps ? BIOMETRIC_UPDATE_EVERY_MINUTE : BIOMETRIC_UPDATE_OPTIMISED;
  s_settings.version = SETTINGS_PERSIST_VERSION;
}

static void settings_migrate_from_v5(const ArgusSettingsV5 *legacy) {
  settings_set_defaults();
  s_settings.hour_format = legacy->hour_format;
  s_settings.clock_font = legacy->clock_font;
  s_settings.week_start = legacy->week_start;
  s_settings.week_number_mode = legacy->week_number_mode;
  s_settings.bluetooth_display = legacy->bluetooth_display;
  s_settings.location_mode = legacy->location_mode;
  s_settings.header_display_mode = legacy->header_display_mode;
  strncpy(s_settings.manual_location, legacy->manual_location, sizeof(s_settings.manual_location) - 1);
  s_settings.manual_location[sizeof(s_settings.manual_location) - 1] = '\0';
  s_settings.forecast_hours = legacy->forecast_hours;
  s_settings.temperature_fahrenheit = legacy->temperature_fahrenheit;
  s_settings.temperature_display = legacy->temperature_display;
  s_settings.show_event_indicators = legacy->show_event_indicators;
  s_settings.debug_mode = legacy->debug_mode;
  s_settings.demo_weather = legacy->demo_weather;
  s_settings.biometric_update_mode = legacy->biometric_update_mode;
  s_settings.version = SETTINGS_PERSIST_VERSION;
}

static void settings_migrate_from_v6(const ArgusSettingsV6 *legacy) {
  settings_set_defaults();
  s_settings.hour_format = legacy->hour_format;
  s_settings.clock_font = legacy->clock_font;
  s_settings.week_start = legacy->week_start;
  s_settings.week_number_mode = legacy->week_number_mode;
  s_settings.bluetooth_display = legacy->bluetooth_display;
  s_settings.location_mode = legacy->location_mode;
  s_settings.header_display_mode = legacy->header_display_mode;
  strncpy(s_settings.manual_location, legacy->manual_location, sizeof(s_settings.manual_location) - 1);
  s_settings.manual_location[sizeof(s_settings.manual_location) - 1] = '\0';
  s_settings.forecast_hours = legacy->forecast_hours;
  s_settings.temperature_fahrenheit = legacy->temperature_fahrenheit;
  s_settings.temperature_display = legacy->temperature_display;
  s_settings.show_event_indicators = legacy->show_event_indicators;
  s_settings.debug_mode = legacy->debug_mode;
  s_settings.demo_weather = legacy->demo_weather;
  s_settings.demo_biometrics = legacy->demo_biometrics;
  s_settings.biometric_update_mode = legacy->biometric_update_mode;
  s_settings.version = SETTINGS_PERSIST_VERSION;
}

void settings_init(void) {
  settings_set_defaults();
  if (!persist_exists(SETTINGS_PERSIST_KEY)) {
    return;
  }

  size_t persist_size = persist_get_size(SETTINGS_PERSIST_KEY);
  if (persist_size == sizeof(ArgusSettings)) {
    persist_read_data(SETTINGS_PERSIST_KEY, &s_settings, sizeof(s_settings));
    if (s_settings.version != SETTINGS_PERSIST_VERSION) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Settings persist version mismatch — resetting defaults");
      settings_set_defaults();
      settings_save();
      return;
    }
    settings_validate();
    return;
  }

  if (persist_size == sizeof(ArgusSettingsV2)) {
    ArgusSettingsV2 legacy;
    persist_read_data(SETTINGS_PERSIST_KEY, &legacy, sizeof(legacy));
    if (legacy.version == 2) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Migrating settings from version 2");
      settings_migrate_from_v2(&legacy);
      settings_validate();
      settings_save();
      return;
    }
  }

  if (persist_size == sizeof(ArgusSettingsV3)) {
    ArgusSettingsV3 legacy;
    persist_read_data(SETTINGS_PERSIST_KEY, &legacy, sizeof(legacy));
    if (legacy.version == 3) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Migrating settings from version 3");
      settings_migrate_from_v3(&legacy);
      settings_validate();
      settings_save();
      return;
    }
  }

  if (persist_size == sizeof(ArgusSettingsV4)) {
    ArgusSettingsV4 legacy;
    persist_read_data(SETTINGS_PERSIST_KEY, &legacy, sizeof(legacy));
    if (legacy.version == 4) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Migrating settings from version 4");
      settings_migrate_from_v4(&legacy);
      settings_validate();
      settings_save();
      return;
    }
  }

  if (persist_size == sizeof(ArgusSettingsV5)) {
    ArgusSettingsV5 legacy;
    persist_read_data(SETTINGS_PERSIST_KEY, &legacy, sizeof(legacy));
    if (legacy.version == 5) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Migrating settings from version 5");
      settings_migrate_from_v5(&legacy);
      settings_validate();
      settings_save();
      return;
    }
  }

  if (persist_size == sizeof(ArgusSettingsV6)) {
    ArgusSettingsV6 legacy;
    persist_read_data(SETTINGS_PERSIST_KEY, &legacy, sizeof(legacy));
    if (legacy.version == 6) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Migrating settings from version 6");
      settings_migrate_from_v6(&legacy);
      settings_validate();
      settings_save();
      return;
    }
  }

  APP_LOG(APP_LOG_LEVEL_INFO, "Settings persist size mismatch — resetting defaults");
  settings_save();
}

const ArgusSettings *settings_get(void) {
  return &s_settings;
}

bool settings_show_calendar_month(void) {
  return s_settings.header_display_mode != HEADER_DISPLAY_FULL_DATE;
}

bool settings_header_shows_biometrics(void) {
  return s_settings.header_display_mode == HEADER_DISPLAY_STEPS ||
         s_settings.header_display_mode == HEADER_DISPLAY_HEART_RATE;
}

bool settings_use_demo_biometrics(void) {
  return s_settings.debug_mode && s_settings.demo_biometrics;
}

void settings_save(void) {
  persist_write_data(SETTINGS_PERSIST_KEY, &s_settings, sizeof(s_settings));
}

static int32_t settings_tuple_to_int32(const Tuple *t) {
  if (!t) {
    return 0;
  }
  if (t->type == TUPLE_INT) {
    return t->value->int32;
  }
  if (t->type == TUPLE_CSTRING) {
    return (int32_t)atoi(t->value->cstring);
  }
  return 0;
}

void settings_apply_from_message(DictionaryIterator *iter) {
  Tuple *t;
  bool changed = false;

  t = dict_find(iter, MESSAGE_KEY_HourFormat);
  if (t) {
    s_settings.hour_format = (HourFormat)settings_tuple_to_int32(t);
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_ClockFont);
  if (t) {
    int32_t font = settings_tuple_to_int32(t);
    if (font >= CLOCK_FONT_LECO && font <= CLOCK_FONT_BITHAM_MEDIUM) {
      s_settings.clock_font = (ClockFont)font;
      changed = true;
    }
  }

  t = dict_find(iter, MESSAGE_KEY_WeekStart);
  if (t) {
    int32_t week_start = settings_tuple_to_int32(t);
    if (week_start == WEEK_START_MONDAY || week_start == WEEK_START_SUNDAY) {
      s_settings.week_start = (WeekStart)week_start;
      changed = true;
    }
  }

  t = dict_find(iter, MESSAGE_KEY_WeekNumberMode);
  if (t) {
    s_settings.week_number_mode = (WeekNumberMode)settings_tuple_to_int32(t);
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_BluetoothDisplay);
  if (t) {
    s_settings.bluetooth_display = (BluetoothDisplay)settings_tuple_to_int32(t);
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_LocationMode);
  if (t) {
    s_settings.location_mode = (LocationMode)settings_tuple_to_int32(t);
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_HeaderDisplay);
  if (t) {
    int32_t mode = settings_tuple_to_int32(t);
    if (mode >= HEADER_DISPLAY_FULL_DATE && mode <= HEADER_DISPLAY_HEART_RATE) {
      s_settings.header_display_mode = (HeaderDisplayMode)mode;
      changed = true;
    }
  }

  t = dict_find(iter, MESSAGE_KEY_ManualLocation);
  if (t && t->type == TUPLE_CSTRING) {
    strncpy(s_settings.manual_location, t->value->cstring, sizeof(s_settings.manual_location) - 1);
    s_settings.manual_location[sizeof(s_settings.manual_location) - 1] = '\0';
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_ForecastHours);
  if (t) {
    uint8_t hours = (uint8_t)settings_tuple_to_int32(t);
    if (hours == 12 || hours == 24 || hours == 48) {
      s_settings.forecast_hours = hours;
      changed = true;
    }
  }

  t = dict_find(iter, MESSAGE_KEY_TemperatureUnit);
  if (t) {
    s_settings.temperature_fahrenheit = settings_tuple_to_int32(t) != 0;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_TemperatureDisplay);
  if (t) {
    int32_t mode = settings_tuple_to_int32(t);
    if (mode >= TEMPERATURE_DISPLAY_ACTUAL && mode <= TEMPERATURE_DISPLAY_FEELS) {
      s_settings.temperature_display = (TemperatureDisplay)mode;
      changed = true;
    }
  }

  t = dict_find(iter, MESSAGE_KEY_DebugMode);
  if (t) {
    s_settings.debug_mode = settings_tuple_to_int32(t) != 0;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_DemoWeather);
  if (t) {
    s_settings.demo_weather = settings_tuple_to_int32(t) != 0;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_DemoBiometrics);
  if (t) {
    s_settings.demo_biometrics = settings_tuple_to_int32(t) != 0;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_RealtimeSteps);
  if (t) {
    int32_t mode = settings_tuple_to_int32(t);
    if (mode >= BIOMETRIC_UPDATE_OPTIMISED && mode <= BIOMETRIC_UPDATE_LIVE) {
      s_settings.biometric_update_mode = (BiometricUpdateMode)mode;
      changed = true;
    }
  }

  t = dict_find(iter, MESSAGE_KEY_PauseWeatherAtNight);
  if (t) {
    s_settings.pause_weather_at_night = settings_tuple_to_int32(t) != 0;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_WeatherUpdateInterval);
  if (t) {
    uint8_t minutes = (uint8_t)settings_tuple_to_int32(t);
    if (settings_is_valid_weather_update_interval(minutes)) {
      s_settings.weather_update_interval_min = minutes;
      changed = true;
    }
  }

  if (changed) {
    s_settings.version = SETTINGS_PERSIST_VERSION;
    settings_save();
  }
}
