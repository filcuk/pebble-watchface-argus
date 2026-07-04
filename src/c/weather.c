#include "weather.h"

#include "settings.h"

#include <string.h>
#include <time.h>

static WeatherData s_weather;
static AppTimer *s_retry_timer;
static AppTimer *s_timeout_timer;
static WeatherUpdatedHandler s_updated_handler;

static void prv_notify_updated(void) {
  if (s_updated_handler) {
    s_updated_handler();
  }
}

static time_t prv_current_hour_start(void) {
  time_t now = time(NULL);
  struct tm *tm = localtime(&now);
  if (!tm) {
    return now;
  }
  tm->tm_min = 0;
  tm->tm_sec = 0;
  return mktime(tm);
}

static void prv_recompute_extremes(void) {
  if (s_weather.hour_count == 0) {
    return;
  }

  int8_t temp_min = 127;
  int8_t temp_max = -128;
  int8_t feels_temp_min = 127;
  int8_t feels_temp_max = -128;
  uint8_t precip_max = 0;
  uint8_t wind_max = 0;

  for (uint8_t i = 0; i < s_weather.hour_count; i++) {
    if (s_weather.temps[i] < temp_min) {
      temp_min = s_weather.temps[i];
    }
    if (s_weather.temps[i] > temp_max) {
      temp_max = s_weather.temps[i];
    }
    if (s_weather.has_feels_temps) {
      if (s_weather.feels_temps[i] < feels_temp_min) {
        feels_temp_min = s_weather.feels_temps[i];
      }
      if (s_weather.feels_temps[i] > feels_temp_max) {
        feels_temp_max = s_weather.feels_temps[i];
      }
    }
    if (s_weather.precips[i] > precip_max) {
      precip_max = s_weather.precips[i];
    }
    if (s_weather.winds[i] > wind_max) {
      wind_max = s_weather.winds[i];
    }
  }

  if (temp_max <= temp_min) {
    temp_max = temp_min + 1;
  }
  if (s_weather.has_feels_temps && feels_temp_max <= feels_temp_min) {
    feels_temp_max = feels_temp_min + 1;
  }
  if (precip_max == 0) {
    precip_max = 1;
  }
  if (wind_max == 0) {
    wind_max = 1;
  }

  s_weather.temp_min = temp_min;
  s_weather.temp_max = temp_max;
  if (s_weather.has_feels_temps) {
    s_weather.feels_temp_min = feels_temp_min;
    s_weather.feels_temp_max = feels_temp_max;
  }
  s_weather.precip_max = precip_max;
  s_weather.wind_max = wind_max;
}

static bool prv_use_feels(void) {
  const ArgusSettings *settings = settings_get();
  return settings->temperature_display == TEMPERATURE_DISPLAY_FEELS && s_weather.has_feels_temps;
}

int8_t weather_display_temp_at(uint8_t index) {
  if (index >= s_weather.hour_count) {
    return 0;
  }
  if (prv_use_feels()) {
    return s_weather.feels_temps[index];
  }
  return s_weather.temps[index];
}

int8_t weather_display_temp_min(void) {
  if (prv_use_feels()) {
    return s_weather.feels_temp_min;
  }
  return s_weather.temp_min;
}

int8_t weather_display_temp_max(void) {
  if (prv_use_feels()) {
    return s_weather.feels_temp_max;
  }
  return s_weather.temp_max;
}

static time_t prv_cache_timestamp(void) {
  if (s_weather.cached_at > 0) {
    return s_weather.cached_at;
  }
  return s_weather.fetch_time;
}

static bool weather_cache_is_valid(void) {
  if (s_weather.hour_count == 0 || s_weather.fetch_time <= 0) {
    return false;
  }

  time_t now = time(NULL);
  time_t cache_time = prv_cache_timestamp();
  if (cache_time <= 0 || now < cache_time) {
    return false;
  }

  return (now - cache_time) <= WEATHER_CACHE_MAX_AGE_S;
}

static void prv_sanitize_persisted_weather(void) {
  if (s_weather.hour_count > WEATHER_MAX_HOURS) {
    s_weather.hour_count = 0;
  }
  if (s_weather.state > WEATHER_STATE_UNAVAILABLE) {
    s_weather.state = WEATHER_STATE_UNAVAILABLE;
  }
}

static void prv_cancel_timers(void) {
  if (s_retry_timer) {
    app_timer_cancel(s_retry_timer);
    s_retry_timer = NULL;
  }
  if (s_timeout_timer) {
    app_timer_cancel(s_timeout_timer);
    s_timeout_timer = NULL;
  }
}

static void prv_retry_callback(void *context) {
  (void)context;
  s_retry_timer = NULL;
  weather_request();
}

static void prv_timeout_callback(void *context) {
  (void)context;
  s_timeout_timer = NULL;
  if (s_weather.state != WEATHER_STATE_LOADING) {
    return;
  }

  if (weather_use_demo_data()) {
    APP_LOG(APP_LOG_LEVEL_INFO, "Weather timeout — using demo data");
    weather_apply_demo_data();
    return;
  }

  if (weather_cache_is_valid()) {
    APP_LOG(APP_LOG_LEVEL_INFO, "Weather timeout — keeping cached forecast");
    s_weather.state = WEATHER_STATE_READY;
    prv_cancel_timers();
    prv_notify_updated();
    return;
  }

  if (!connection_service_peek_pebble_app_connection()) {
    APP_LOG(APP_LOG_LEVEL_INFO, "Weather timeout — phone unavailable");
    weather_mark_unavailable();
  } else {
    APP_LOG(APP_LOG_LEVEL_INFO, "Weather timeout — fetch failed");
    weather_mark_error();
  }
}

bool weather_use_demo_data(void) {
  const ArgusSettings *settings = settings_get();
  return settings->debug_mode && settings->demo_weather;
}

void weather_mark_unavailable(void) {
  if (weather_cache_is_valid()) {
    s_weather.state = WEATHER_STATE_READY;
    prv_notify_updated();
    return;
  }

  s_weather.state = WEATHER_STATE_UNAVAILABLE;
  prv_cancel_timers();
  prv_notify_updated();
}

void weather_refresh_for_connection(bool phone_connected) {
  if (weather_use_demo_data()) {
    weather_apply_demo_data();
    return;
  }

  if (phone_connected) {
    weather_request();
    return;
  }

  if (weather_cache_is_valid()) {
    s_weather.state = WEATHER_STATE_READY;
    prv_cancel_timers();
    prv_notify_updated();
    return;
  }

  weather_mark_unavailable();
}

void weather_init(void) {
  memset(&s_weather, 0, sizeof(s_weather));
  s_weather.version = WEATHER_PERSIST_VERSION;
  s_weather.state = WEATHER_STATE_LOADING;
  memset(s_weather.is_day, 1, sizeof(s_weather.is_day));
  if (persist_exists(WEATHER_PERSIST_KEY)) {
    if (persist_get_size(WEATHER_PERSIST_KEY) != sizeof(WeatherData)) {
      APP_LOG(APP_LOG_LEVEL_INFO, "Weather persist size mismatch — starting fresh");
    } else {
      persist_read_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
      if (s_weather.version != WEATHER_PERSIST_VERSION) {
        APP_LOG(APP_LOG_LEVEL_INFO, "Weather persist version mismatch — starting fresh");
        memset(&s_weather, 0, sizeof(s_weather));
        s_weather.version = WEATHER_PERSIST_VERSION;
        s_weather.state = WEATHER_STATE_LOADING;
        memset(s_weather.is_day, 1, sizeof(s_weather.is_day));
      } else {
        prv_sanitize_persisted_weather();
        if (s_weather.hour_count > 0 && !s_weather.has_is_day) {
          memset(s_weather.is_day, 1, sizeof(s_weather.is_day));
        }
        weather_slide_stale_hours();
        if (s_weather.cached_at == 0 && s_weather.hour_count > 0 && s_weather.state == WEATHER_STATE_READY) {
          s_weather.cached_at = time(NULL);
          persist_write_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
        }
      }
    }
  }

  if (!connection_service_peek_pebble_app_connection()) {
    weather_refresh_for_connection(false);
  }
}

WeatherData *weather_get(void) {
  return &s_weather;
}

void weather_mark_error(void) {
  s_weather.state = WEATHER_STATE_ERROR;
}

void weather_apply_demo_data(void) {
  if (!weather_use_demo_data()) {
    return;
  }

  s_weather.hour_count = 24;
  s_weather.temp_min = 6;
  s_weather.temp_max = 16;
  s_weather.feels_temp_min = 4;
  s_weather.feels_temp_max = 14;
  s_weather.precip_max = 40;
  s_weather.wind_max = 30;
  s_weather.fetch_time = prv_current_hour_start();

  for (uint8_t i = 0; i < 24; i++) {
    s_weather.temps[i] = (int8_t)(8 + ((i * 3) % 9));
    s_weather.feels_temps[i] = (int8_t)(s_weather.temps[i] - 2);
    s_weather.precips[i] = (uint8_t)((i % 5) * 8);
    s_weather.winds[i] = (uint8_t)(5 + ((i * 7) % 20));
    time_t hour_time = s_weather.fetch_time + (time_t)i * 3600;
    struct tm *tm_hour = localtime(&hour_time);
    int hour = tm_hour ? tm_hour->tm_hour : (int)i;
    s_weather.is_day[i] = (hour >= 6 && hour < 20) ? 1 : 0;
  }
  s_weather.has_is_day = true;
  s_weather.has_wind = true;
  s_weather.has_feels_temps = true;

  s_weather.version = WEATHER_PERSIST_VERSION;
  s_weather.cached_at = time(NULL);
  s_weather.state = WEATHER_STATE_READY;
  persist_write_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
  prv_cancel_timers();
  prv_notify_updated();
}

void weather_apply_from_message(DictionaryIterator *iter) {
  if (weather_use_demo_data()) {
    return;
  }

  Tuple *t = dict_find(iter, MESSAGE_KEY_WeatherTempHourly);
  if (!t || t->type != TUPLE_BYTE_ARRAY) {
    APP_LOG(APP_LOG_LEVEL_WARNING, "Weather: missing or invalid temp array (type %d)", t ? (int)t->type : -1);
    weather_mark_error();
    prv_cancel_timers();
    prv_notify_updated();
    return;
  }

  uint8_t count = 0;
  Tuple *count_tuple = dict_find(iter, MESSAGE_KEY_WeatherHourCount);
  if (count_tuple) {
    count = (uint8_t)count_tuple->value->int32;
  }
  if (count == 0 || count > WEATHER_MAX_HOURS) {
    count = t->length;
  }
  if (count > WEATHER_MAX_HOURS) {
    count = WEATHER_MAX_HOURS;
  }
  if (count > t->length) {
    count = t->length;
  }

  memcpy(s_weather.temps, t->value->data, count);

  Tuple *feels_tuple = dict_find(iter, MESSAGE_KEY_WeatherFeelsTempHourly);
  if (feels_tuple && feels_tuple->type == TUPLE_BYTE_ARRAY) {
    uint8_t feels_len = feels_tuple->length;
    if (feels_len > count) {
      feels_len = count;
    }
    memset(s_weather.feels_temps, 0, sizeof(s_weather.feels_temps));
    memcpy(s_weather.feels_temps, feels_tuple->value->data, feels_len);
    s_weather.has_feels_temps = true;
  } else {
    s_weather.has_feels_temps = false;
  }

  Tuple *precip_tuple = dict_find(iter, MESSAGE_KEY_WeatherPrecipHourly);
  if (precip_tuple && precip_tuple->type == TUPLE_BYTE_ARRAY) {
    uint8_t precip_len = precip_tuple->length;
    if (precip_len > count) {
      precip_len = count;
    }
    memset(s_weather.precips, 0, sizeof(s_weather.precips));
    memcpy(s_weather.precips, precip_tuple->value->data, precip_len);
  }

  Tuple *is_day_tuple = dict_find(iter, MESSAGE_KEY_WeatherIsDayHourly);
  if (is_day_tuple && is_day_tuple->type == TUPLE_BYTE_ARRAY) {
    uint8_t is_day_len = is_day_tuple->length;
    if (is_day_len > count) {
      is_day_len = count;
    }
    memset(s_weather.is_day, 1, sizeof(s_weather.is_day));
    memcpy(s_weather.is_day, is_day_tuple->value->data, is_day_len);
    s_weather.has_is_day = true;
  }

  Tuple *wind_tuple = dict_find(iter, MESSAGE_KEY_WeatherWindHourly);
  if (wind_tuple && wind_tuple->type == TUPLE_BYTE_ARRAY) {
    uint8_t wind_len = wind_tuple->length;
    if (wind_len > count) {
      wind_len = count;
    }
    memset(s_weather.winds, 0, sizeof(s_weather.winds));
    memcpy(s_weather.winds, wind_tuple->value->data, wind_len);
    s_weather.has_wind = true;
  }

  t = dict_find(iter, MESSAGE_KEY_TempMin);
  if (t) {
    s_weather.temp_min = (int8_t)t->value->int32;
  }

  t = dict_find(iter, MESSAGE_KEY_TempMax);
  if (t) {
    s_weather.temp_max = (int8_t)t->value->int32;
  }

  t = dict_find(iter, MESSAGE_KEY_FeelsTempMin);
  if (t) {
    s_weather.feels_temp_min = (int8_t)t->value->int32;
  }

  t = dict_find(iter, MESSAGE_KEY_FeelsTempMax);
  if (t) {
    s_weather.feels_temp_max = (int8_t)t->value->int32;
  }

  t = dict_find(iter, MESSAGE_KEY_PrecipMax);
  if (t) {
    s_weather.precip_max = (uint8_t)t->value->int32;
  }

  t = dict_find(iter, MESSAGE_KEY_WindMax);
  if (t) {
    s_weather.wind_max = (uint8_t)t->value->int32;
  }

  t = dict_find(iter, MESSAGE_KEY_WeatherFetchTime);
  if (t) {
    s_weather.fetch_time = (time_t)t->value->int32;
  }

  s_weather.hour_count = count;
  s_weather.version = WEATHER_PERSIST_VERSION;
  s_weather.cached_at = time(NULL);
  s_weather.state = WEATHER_STATE_READY;
  persist_write_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
  prv_cancel_timers();
  prv_notify_updated();
}

void weather_schedule_retry(void) {
  if (!s_retry_timer) {
    s_retry_timer = app_timer_register(3000, prv_retry_callback, NULL);
  }
  if (!s_timeout_timer) {
    s_timeout_timer = app_timer_register(30000, prv_timeout_callback, NULL);
  }
}

void weather_set_updated_handler(WeatherUpdatedHandler handler) {
  s_updated_handler = handler;
}

void weather_slide_stale_hours(void) {
  if (s_weather.state != WEATHER_STATE_READY || s_weather.hour_count == 0 || s_weather.fetch_time <= 0) {
    return;
  }

  time_t now = time(NULL);
  int hours_elapsed = (int)((now - s_weather.fetch_time) / 3600);
  if (hours_elapsed <= 0) {
    return;
  }

  if (hours_elapsed >= s_weather.hour_count) {
    s_weather.hour_count = 0;
    persist_write_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
    if (weather_use_demo_data()) {
      weather_apply_demo_data();
    } else if (connection_service_peek_pebble_app_connection()) {
      s_weather.state = WEATHER_STATE_LOADING;
      weather_request();
    } else {
      weather_mark_unavailable();
    }
    return;
  }

  uint8_t remain = s_weather.hour_count - (uint8_t)hours_elapsed;
  memmove(s_weather.temps, s_weather.temps + hours_elapsed, remain);
  memmove(s_weather.feels_temps, s_weather.feels_temps + hours_elapsed, remain);
  memmove(s_weather.precips, s_weather.precips + hours_elapsed, remain);
  memmove(s_weather.winds, s_weather.winds + hours_elapsed, remain);
  memmove(s_weather.is_day, s_weather.is_day + hours_elapsed, remain);

  s_weather.hour_count = remain;
  s_weather.fetch_time += (time_t)hours_elapsed * 3600;
  s_weather.version = WEATHER_PERSIST_VERSION;
  prv_recompute_extremes();
  persist_write_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
  prv_notify_updated();
}

void weather_request(void) {
  if (weather_use_demo_data()) {
    weather_apply_demo_data();
    return;
  }

  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    weather_schedule_retry();
    return;
  }
  dict_write_uint8(iter, MESSAGE_KEY_REQUEST_WEATHER, 1);
  AppMessageResult result = app_message_outbox_send();
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_WARNING, "Weather request send failed: %d", (int)result);
    weather_schedule_retry();
    return;
  }
  if (s_weather.hour_count == 0 || s_weather.state == WEATHER_STATE_ERROR ||
      s_weather.state == WEATHER_STATE_UNAVAILABLE) {
    if (!weather_cache_is_valid()) {
      s_weather.state = WEATHER_STATE_LOADING;
    }
  }
  weather_schedule_retry();
}
