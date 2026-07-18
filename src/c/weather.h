#pragma once

#include <pebble.h>

#define WEATHER_MAX_HOURS 72
#define WEATHER_PERSIST_KEY_META 3
#define WEATHER_PERSIST_KEY_TEMPS 30
#define WEATHER_PERSIST_KEY_FEELS 31
#define WEATHER_PERSIST_KEY_PRECIP 32
#define WEATHER_PERSIST_KEY_WIND 33
#define WEATHER_PERSIST_KEY_IS_DAY 34
#define WEATHER_PERSIST_VERSION 4
#define WEATHER_CACHE_MAX_AGE_S (12 * 3600)
#define WEATHER_STATUS_LOCATION_PENDING 0x01

typedef enum {
  WEATHER_STATE_LOADING = 0,
  WEATHER_STATE_READY = 1,
  WEATHER_STATE_ERROR = 2,
  WEATHER_STATE_UNAVAILABLE = 3,
} WeatherState;

typedef enum {
  WEATHER_FRESHNESS_OK = 0,
  WEATHER_FRESHNESS_STALE = 1,
  WEATHER_FRESHNESS_CRITICAL = 2,
} WeatherFreshness;

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
  time_t api_fetched_at;
  int32_t api_lat_e4;
  int32_t api_lon_e4;
  uint8_t status_flags;
} WeatherData;

typedef void (*WeatherUpdatedHandler)(void);

typedef struct {
  uint8_t start_index;
  uint8_t hour_count;
} WeatherView;

void weather_init(void);
void weather_deinit(void);
WeatherData *weather_get(void);
void weather_apply_from_message(DictionaryIterator *iter);
void weather_apply_demo_data(void);
void weather_request(void);
void weather_request_force(void);
/* Age/coverage-aware: night-pause skip if covering; else stale if missing
 * coverage; else periodic if due; else noop. Prefer this over force. */
void weather_request_if_needed(void);
bool weather_is_night_now(void);
bool weather_is_night_pause_active(void);
bool weather_is_refresh_due(void);
WeatherFreshness weather_get_freshness(void);
void weather_mark_error(void);
void weather_mark_unavailable(void);
void weather_mark_fetch_failed(void);
bool weather_use_demo_data(void);
void weather_refresh_for_connection(bool phone_connected);
void weather_schedule_retry(void);
void weather_set_updated_handler(WeatherUpdatedHandler handler);
void weather_slide_stale_hours(void);
void weather_get_view(WeatherView *view);
bool weather_view_has_data(const WeatherView *view);
void weather_ensure_view_coverage(void);
void weather_request_for_time(time_t when_hour);
int8_t weather_display_temp_at(uint8_t index);
int8_t weather_display_temp_min_for_view(const WeatherView *view);
int8_t weather_display_temp_max_for_view(const WeatherView *view);
uint8_t weather_precip_max_for_view(const WeatherView *view);
uint8_t weather_wind_max_for_view(const WeatherView *view);
int8_t weather_display_temp_min(void);
int8_t weather_display_temp_max(void);
