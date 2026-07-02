#pragma once

#include <pebble.h>

#define WEATHER_MAX_HOURS 72
#define WEATHER_PERSIST_KEY 3

typedef enum {
  WEATHER_STATE_LOADING = 0,
  WEATHER_STATE_READY = 1,
  WEATHER_STATE_ERROR = 2,
} WeatherState;

typedef struct {
  WeatherState state;
  uint8_t hour_count;
  int8_t temps[WEATHER_MAX_HOURS];
  uint8_t precips[WEATHER_MAX_HOURS];
  uint8_t winds[WEATHER_MAX_HOURS];
  uint8_t is_day[WEATHER_MAX_HOURS];
  bool has_is_day;
  bool has_wind;
  int8_t temp_min;
  int8_t temp_max;
  uint8_t precip_max;
  uint8_t wind_max;
  time_t fetch_time;
} WeatherData;

typedef void (*WeatherUpdatedHandler)(void);

void weather_init(void);
WeatherData *weather_get(void);
void weather_apply_from_message(DictionaryIterator *iter);
void weather_apply_demo_data(void);
void weather_request(void);
void weather_mark_loading(void);
void weather_mark_error(void);
void weather_schedule_retry(void);
void weather_cancel_retry(void);
void weather_set_updated_handler(WeatherUpdatedHandler handler);
