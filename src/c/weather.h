#pragma once

#include <pebble.h>

#define WEATHER_MAX_HOURS 72
#define WEATHER_PERSIST_KEY 3
#define WEATHER_PERSIST_VERSION 2
#define WEATHER_CACHE_MAX_AGE_S (12 * 3600)

typedef enum {
  WEATHER_STATE_LOADING = 0,
  WEATHER_STATE_READY = 1,
  WEATHER_STATE_ERROR = 2,
  WEATHER_STATE_UNAVAILABLE = 3,
} WeatherState;

typedef struct {
  uint8_t version;
  WeatherState state;
  uint8_t hour_count;
  int8_t temps[WEATHER_MAX_HOURS];
  int8_t feels_temps[WEATHER_MAX_HOURS];
  uint8_t precips[WEATHER_MAX_HOURS];
  uint8_t winds[WEATHER_MAX_HOURS];
  uint8_t is_day[WEATHER_MAX_HOURS];
  bool has_is_day;
  bool has_wind;
  bool has_feels_temps;
  int8_t temp_min;
  int8_t temp_max;
  int8_t feels_temp_min;
  int8_t feels_temp_max;
  uint8_t precip_max;
  uint8_t wind_max;
  time_t fetch_time;
  time_t cached_at;
} WeatherData;

typedef void (*WeatherUpdatedHandler)(void);

void weather_init(void);
WeatherData *weather_get(void);
void weather_apply_from_message(DictionaryIterator *iter);
void weather_apply_demo_data(void);
void weather_request(void);
void weather_mark_error(void);
void weather_mark_unavailable(void);
bool weather_use_demo_data(void);
void weather_refresh_for_connection(bool phone_connected);
void weather_schedule_retry(void);
void weather_set_updated_handler(WeatherUpdatedHandler handler);
void weather_slide_stale_hours(void);
int8_t weather_display_temp_at(uint8_t index);
int8_t weather_display_temp_min(void);
int8_t weather_display_temp_max(void);
