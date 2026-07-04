#include "settings.h"

#include <stdlib.h>
#include <string.h>

static ArgusSettings s_settings;

static void settings_set_defaults(void) {
  s_settings.version = SETTINGS_PERSIST_VERSION;
  s_settings.hour_format = HOUR_FORMAT_SYSTEM;
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
}

static void settings_validate(void) {
  if (s_settings.header_display_mode > HEADER_DISPLAY_TEMP_RANGE) {
    s_settings.header_display_mode = HEADER_DISPLAY_FULL_DATE;
  }
  if (s_settings.week_start != WEEK_START_MONDAY && s_settings.week_start != WEEK_START_SUNDAY) {
    s_settings.week_start = WEEK_START_MONDAY;
  }
  if (s_settings.temperature_display > TEMPERATURE_DISPLAY_FEELS) {
    s_settings.temperature_display = TEMPERATURE_DISPLAY_ACTUAL;
  }
}

void settings_init(void) {
  settings_set_defaults();
  if (persist_exists(SETTINGS_PERSIST_KEY)) {
    if (persist_get_size(SETTINGS_PERSIST_KEY) != sizeof(ArgusSettings)) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Settings persist size mismatch — resetting defaults");
      settings_save();
      return;
    }
    persist_read_data(SETTINGS_PERSIST_KEY, &s_settings, sizeof(s_settings));
    if (s_settings.version != SETTINGS_PERSIST_VERSION) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Settings persist version mismatch — resetting defaults");
      settings_set_defaults();
      settings_save();
      return;
    }
    settings_validate();
  }
}

const ArgusSettings *settings_get(void) {
  return &s_settings;
}

bool settings_show_calendar_month(void) {
  return s_settings.header_display_mode != HEADER_DISPLAY_FULL_DATE;
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
    if (mode >= HEADER_DISPLAY_FULL_DATE && mode <= HEADER_DISPLAY_TEMP_RANGE) {
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

  if (changed) {
    s_settings.version = SETTINGS_PERSIST_VERSION;
    settings_save();
  }
}
