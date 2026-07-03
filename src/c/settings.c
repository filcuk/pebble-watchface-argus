#include "settings.h"

#include <string.h>

static ArgusSettings s_settings;

static void settings_set_defaults(void) {
  s_settings.hour_format = HOUR_FORMAT_SYSTEM;
  s_settings.week_start = WEEK_START_MONDAY;
  s_settings.week_number_mode = WEEK_NUMBER_ISO;
  s_settings.bluetooth_display = BT_DISPLAY_DISCONNECTED_ONLY;
  s_settings.location_mode = LOCATION_MODE_GPS;
  s_settings.manual_location[0] = '\0';
  s_settings.forecast_hours = 24;
  s_settings.temperature_fahrenheit = false;
  s_settings.show_event_indicators = false;
  s_settings.debug_mode = false;
  s_settings.demo_weather = false;
}

void settings_init(void) {
  settings_set_defaults();
  if (persist_exists(SETTINGS_PERSIST_KEY)) {
    persist_read_data(SETTINGS_PERSIST_KEY, &s_settings, sizeof(s_settings));
  }
}

const ArgusSettings *settings_get(void) {
  return &s_settings;
}

void settings_save(void) {
  persist_write_data(SETTINGS_PERSIST_KEY, &s_settings, sizeof(s_settings));
}

void settings_apply_from_message(DictionaryIterator *iter) {
  Tuple *t;
  bool changed = false;

  t = dict_find(iter, MESSAGE_KEY_HourFormat);
  if (t) {
    s_settings.hour_format = (HourFormat)t->value->int32;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_WeekStart);
  if (t) {
    s_settings.week_start = (WeekStart)t->value->int32;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_WeekNumberMode);
  if (t) {
    s_settings.week_number_mode = (WeekNumberMode)t->value->int32;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_BluetoothDisplay);
  if (t) {
    s_settings.bluetooth_display = (BluetoothDisplay)t->value->int32;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_LocationMode);
  if (t) {
    s_settings.location_mode = (LocationMode)t->value->int32;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_ManualLocation);
  if (t && t->type == TUPLE_CSTRING) {
    strncpy(s_settings.manual_location, t->value->cstring, sizeof(s_settings.manual_location) - 1);
    s_settings.manual_location[sizeof(s_settings.manual_location) - 1] = '\0';
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_ForecastHours);
  if (t) {
    uint8_t hours = (uint8_t)t->value->int32;
    if (hours == 24 || hours == 48 || hours == 72) {
      s_settings.forecast_hours = hours;
      changed = true;
    }
  }

  t = dict_find(iter, MESSAGE_KEY_TemperatureUnit);
  if (t) {
    s_settings.temperature_fahrenheit = t->value->int32 != 0;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_DebugMode);
  if (t) {
    s_settings.debug_mode = t->value->int32 != 0;
    changed = true;
  }

  t = dict_find(iter, MESSAGE_KEY_DemoWeather);
  if (t) {
    s_settings.demo_weather = t->value->int32 != 0;
    changed = true;
  }

  if (changed) {
    settings_save();
  }
}
