#include "weather.h"

#include <string.h>

static WeatherData s_weather;

void weather_init(void) {
  memset(&s_weather, 0, sizeof(s_weather));
  s_weather.state = WEATHER_STATE_LOADING;
  if (persist_exists(WEATHER_PERSIST_KEY)) {
    persist_read_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
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

void weather_apply_from_message(DictionaryIterator *iter) {
  Tuple *t = dict_find(iter, MESSAGE_KEY_WeatherTempHourly);
  if (!t || t->type != TUPLE_BYTE_ARRAY) {
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

  t = dict_find(iter, MESSAGE_KEY_WeatherFetchTime);
  if (t) {
    s_weather.fetch_time = (time_t)t->value->int32;
  }

  s_weather.hour_count = count;
  s_weather.state = WEATHER_STATE_READY;
  persist_write_data(WEATHER_PERSIST_KEY, &s_weather, sizeof(s_weather));
}

void weather_request(void) {
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }
  dict_write_uint8(iter, MESSAGE_KEY_REQUEST_WEATHER, 1);
  app_message_outbox_send();
  s_weather.state = WEATHER_STATE_LOADING;
}
