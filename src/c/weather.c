#include "weather.h"

#include <string.h>

static WeatherData s_weather;
static AppTimer *s_retry_timer;
static AppTimer *s_timeout_timer;
static WeatherUpdatedHandler s_updated_handler;

static void prv_notify_updated(void) {
  if (s_updated_handler) {
    s_updated_handler();
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
  if (s_weather.state == WEATHER_STATE_LOADING) {
    APP_LOG(APP_LOG_LEVEL_INFO, "Weather timeout — using demo data");
    weather_apply_demo_data();
  }
}

void weather_init(void) {
  memset(&s_weather, 0, sizeof(s_weather));
  s_weather.state = WEATHER_STATE_LOADING;
  memset(s_weather.is_day, 1, sizeof(s_weather.is_day));
  if (persist_exists(WEATHER_PERSIST_KEY)) {
    persist_read_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
    if (s_weather.hour_count > 0 && !s_weather.has_is_day) {
      memset(s_weather.is_day, 1, sizeof(s_weather.is_day));
    }
  }
}

WeatherData *weather_get(void) {
  return &s_weather;
}

void weather_mark_loading(void) {
  s_weather.state = WEATHER_STATE_LOADING;
}

void weather_mark_error(void) {
  s_weather.state = WEATHER_STATE_ERROR;
}

void weather_apply_demo_data(void) {
  s_weather.hour_count = 24;
  s_weather.temp_min = 6;
  s_weather.temp_max = 16;
  s_weather.precip_max = 40;
  s_weather.wind_max = 30;
  s_weather.fetch_time = time(NULL);

  for (uint8_t i = 0; i < 24; i++) {
    s_weather.temps[i] = (int8_t)(8 + ((i * 3) % 9));
    s_weather.precips[i] = (uint8_t)((i % 5) * 8);
    s_weather.winds[i] = (uint8_t)(5 + ((i * 7) % 20));
    time_t hour_time = s_weather.fetch_time + (time_t)i * 3600;
    struct tm *tm_hour = localtime(&hour_time);
    int hour = tm_hour ? tm_hour->tm_hour : (int)i;
    s_weather.is_day[i] = (hour >= 6 && hour < 20) ? 1 : 0;
  }
  s_weather.has_is_day = true;
  s_weather.has_wind = true;

  s_weather.state = WEATHER_STATE_READY;
  persist_write_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
  prv_cancel_timers();
  prv_notify_updated();
}

void weather_apply_from_message(DictionaryIterator *iter) {
  Tuple *t = dict_find(iter, MESSAGE_KEY_WeatherTempHourly);
  if (!t || t->type != TUPLE_BYTE_ARRAY) {
    APP_LOG(APP_LOG_LEVEL_WARNING, "Weather: missing or invalid temp array (type %d)", t ? (int)t->type : -1);
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
    s_timeout_timer = app_timer_register(15000, prv_timeout_callback, NULL);
  }
}

void weather_cancel_retry(void) {
  prv_cancel_timers();
}

void weather_set_updated_handler(WeatherUpdatedHandler handler) {
  s_updated_handler = handler;
}

void weather_request(void) {
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
  if (s_weather.hour_count == 0 || s_weather.state == WEATHER_STATE_ERROR) {
    s_weather.state = WEATHER_STATE_LOADING;
  }
  weather_schedule_retry();
}
