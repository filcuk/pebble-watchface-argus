#include <pebble.h>

#include "argus_time.h"
#include "calendar.h"
#include "header.h"
#include "hr_day.h"
#include "settings.h"
#include "time_display.h"
#include "weather.h"
#include "weather_chart.h"

static Window *s_main_window;
static Layer *s_window_layer;
static Header *s_header;
static Calendar *s_calendar;
static TimeDisplay *s_time_display;
static WeatherChart *s_weather_chart;
static UnobstructedAreaHandlers s_unobstructed_handlers;
static time_t s_last_periodic_weather_refresh;

static void prv_holidays_request(void) {
  if (!settings_get()->show_event_indicators) {
    if (s_calendar) {
      calendar_set_event_days(s_calendar, 0);
    }
    return;
  }

  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }

  dict_write_uint8(iter, MESSAGE_KEY_REQUEST_HOLIDAYS, 1);
  app_message_outbox_send();
}

static void prv_apply_holiday_mask(uint16_t mask) {
  if (!s_calendar) {
    return;
  }
  if (!settings_get()->show_event_indicators) {
    calendar_set_event_days(s_calendar, 0);
    return;
  }
  calendar_set_event_days(s_calendar, mask);
}

#if defined(PBL_HEALTH)
#define BIOMETRIC_SAMPLE_PERIOD_SEC 60
#define BIOMETRIC_LIVE_SAMPLE_PERIOD_SEC 5
#define BIOMETRIC_LOAD_REFRESH_MS 50
#define HR_BACKFILL_START_DELAY_MS 3000
#define HR_BACKFILL_CHUNK_MS 100

static AppTimer *s_biometric_load_timer;
static AppTimer *s_hr_backfill_start_timer;
static AppTimer *s_hr_backfill_chunk_timer;

static void prv_sync_health_sampling(void);
static void prv_refresh_biometric_header(void);
static void prv_schedule_biometric_load_refresh(void);
static void prv_schedule_hr_backfill(void);
static void prv_cancel_hr_backfill(void);
static bool prv_should_run_hr_backfill(void);
#endif

static uint8_t prv_weather_update_interval_minutes(void) {
  uint8_t minutes = settings_get()->weather_update_interval_min;
  if (minutes != WEATHER_UPDATE_INTERVAL_5_MIN && minutes != WEATHER_UPDATE_INTERVAL_15_MIN &&
      minutes != WEATHER_UPDATE_INTERVAL_30_MIN && minutes != WEATHER_UPDATE_INTERVAL_60_MIN &&
      minutes != WEATHER_UPDATE_INTERVAL_120_MIN && minutes != WEATHER_UPDATE_INTERVAL_180_MIN) {
    return WEATHER_UPDATE_INTERVAL_60_MIN;
  }
  return minutes;
}

static void prv_update_layout(void) {
  if (!s_window_layer) {
    return;
  }

  GRect bounds = layer_get_unobstructed_bounds(s_window_layer);
  int width = bounds.size.w;
  int height = bounds.size.h;

  int time_h = TIME_BLOCK_HEIGHT;
  int calendar_h = CALENDAR_HEIGHT;
  int header_h = HEADER_HEIGHT;
  int time_zone_top = header_h + calendar_h + TIME_CALENDAR_GAP;

  int time_y = time_zone_top;
  int weather_y = time_y + time_h + TIME_WEATHER_GAP;
  int weather_h = height - weather_y;

  int max_weather_h = WEATHER_CHART_HEIGHT;
  if (max_weather_h > height / 2) {
    max_weather_h = height / 2;
  }

  if (weather_h > max_weather_h) {
    weather_h = max_weather_h;
    weather_y = height - weather_h;
    int time_zone_bottom = weather_y - TIME_WEATHER_GAP;
    if (time_zone_bottom >= time_zone_top + time_h) {
      time_y = time_zone_top + (time_zone_bottom - time_zone_top - time_h) / 2;
    } else {
      time_y = time_zone_top;
      weather_y = time_y + time_h + TIME_WEATHER_GAP;
      weather_h = height - weather_y;
    }
  }

  if (weather_h < WEATHER_CHART_MIN_HEIGHT) {
    weather_h = 0;
    weather_y = height;
    if (height >= time_zone_top + time_h) {
      time_y = time_zone_top + (height - time_zone_top - time_h) / 2;
    } else {
      time_y = time_zone_top;
    }
  }

  header_set_bounds(s_header, GRect(0, 0, width, header_h));
  calendar_set_bounds(s_calendar, GRect(0, header_h, width, calendar_h));
  time_display_set_bounds(s_time_display, GRect(0, time_y, width, time_h));
  weather_chart_set_bounds(s_weather_chart, GRect(0, weather_y, width, weather_h));
}

static void prv_unobstructed_change(AnimationProgress progress, void *context) {
  (void)progress;
  (void)context;
  prv_update_layout();
}

static void prv_refresh_all_modules(struct tm *now) {
  struct tm now_copy = *now;

  header_invalidate(s_header);
  calendar_invalidate(s_calendar);
  header_apply_settings(s_header);
  header_update(s_header, &now_copy);
  time_display_update(s_time_display, &now_copy);
  calendar_update(s_calendar, &now_copy);
  weather_chart_refresh(s_weather_chart);
}

static void prv_tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  (void)tick_time;
  time_t now = argus_time_now();
  struct tm *tm_now = localtime(&now);
  if (!tm_now) {
    return;
  }
  struct tm tick_copy = *tm_now;

  weather_slide_stale_hours();
  time_display_update(s_time_display, &tick_copy);

  if (units_changed & DAY_UNIT) {
    if (settings_header_shows_biometrics()) {
      header_invalidate(s_header);
#if defined(PBL_HEALTH)
      hr_day_on_day_change();
      prv_schedule_biometric_load_refresh();
      prv_schedule_hr_backfill();
#endif
    }
    prv_holidays_request();
  }

  header_update(s_header, &tick_copy);
  calendar_update(s_calendar, &tick_copy);
  header_refresh_quiet_time(s_header, quiet_time_is_active());
  header_refresh_weather_status(s_header);

#if defined(PBL_HEALTH)
  if (settings_get()->biometric_update_mode == BIOMETRIC_UPDATE_EVERY_MINUTE &&
      settings_header_shows_biometrics()) {
    prv_refresh_biometric_header();
  }
#endif

  uint8_t interval_min = prv_weather_update_interval_minutes();
  if (s_last_periodic_weather_refresh == 0 ||
      (now - s_last_periodic_weather_refresh) >= (time_t)interval_min * 60) {
    weather_request();
    s_last_periodic_weather_refresh = now;
  }
}

static void prv_inbox_received(DictionaryIterator *iter, void *context) {
  (void)context;
  bool request_weather = false;

  /* PKJS failure signal: WeatherHourCount without WeatherTempHourly. */
  if (dict_find(iter, MESSAGE_KEY_WeatherHourCount) && !dict_find(iter, MESSAGE_KEY_WeatherTempHourly)) {
    weather_mark_fetch_failed();
    return;
  }

  if (dict_find(iter, MESSAGE_KEY_LocationMode) || dict_find(iter, MESSAGE_KEY_ManualLocation) ||
      dict_find(iter, MESSAGE_KEY_ForecastHours) || dict_find(iter, MESSAGE_KEY_TemperatureUnit) ||
      dict_find(iter, MESSAGE_KEY_WeatherProvider) || dict_find(iter, MESSAGE_KEY_PauseWeatherAtNight) ||
      dict_find(iter, MESSAGE_KEY_WeatherUpdateInterval) || dict_find(iter, MESSAGE_KEY_GpsMaxAge)) {
    request_weather = true;
  }

  bool calendar_settings = dict_find(iter, MESSAGE_KEY_WeekStart) || dict_find(iter, MESSAGE_KEY_WeekNumberMode) ||
                           dict_find(iter, MESSAGE_KEY_HeaderDisplay) || dict_find(iter, MESSAGE_KEY_ShowHolidays);
  bool header_settings = dict_find(iter, MESSAGE_KEY_HeaderDisplay) || dict_find(iter, MESSAGE_KEY_FullDateFormat) ||
                         dict_find(iter, MESSAGE_KEY_RealtimeSteps) || dict_find(iter, MESSAGE_KEY_TemperatureUnit) ||
                         dict_find(iter, MESSAGE_KEY_TemperatureDisplay) ||
                         dict_find(iter, MESSAGE_KEY_BluetoothDisplay) ||
                         dict_find(iter, MESSAGE_KEY_QuietModeDisplay);

  settings_apply_from_message(iter);
  if (dict_find(iter, MESSAGE_KEY_WeatherTempHourly)) {
    weather_apply_from_message(iter);
  }

  Tuple *holiday_mask_tuple = dict_find(iter, MESSAGE_KEY_CalendarHolidayMask);
  if (holiday_mask_tuple) {
    uint16_t mask = 0;
    if (holiday_mask_tuple->type == TUPLE_INT) {
      mask = (uint16_t)holiday_mask_tuple->value->int32;
    }
    prv_apply_holiday_mask(mask);
  }

  if (dict_find(iter, MESSAGE_KEY_ShowHolidays) && !settings_get()->show_event_indicators) {
    prv_apply_holiday_mask(0);
    calendar_invalidate(s_calendar);
  }

  if (dict_find(iter, MESSAGE_KEY_DebugMode) || dict_find(iter, MESSAGE_KEY_DemoWeather)) {
    weather_refresh_for_connection(connection_service_peek_pebble_app_connection());
  }

#if defined(PBL_HEALTH)
  if (dict_find(iter, MESSAGE_KEY_DebugMode) || dict_find(iter, MESSAGE_KEY_DemoBiometrics)) {
    prv_refresh_biometric_header();
  }
#endif

  if (calendar_settings) {
    calendar_invalidate(s_calendar);
  }
  if (header_settings) {
    header_invalidate(s_header);
    header_apply_settings(s_header);
#if defined(PBL_HEALTH)
    if (dict_find(iter, MESSAGE_KEY_HeaderDisplay) || dict_find(iter, MESSAGE_KEY_RealtimeSteps)) {
      prv_sync_health_sampling();
      prv_refresh_biometric_header();
      prv_schedule_biometric_load_refresh();
      prv_schedule_hr_backfill();
    }
#endif
  }
  if (dict_find(iter, MESSAGE_KEY_ClockFont) && s_time_display) {
    time_display_apply_settings(s_time_display);
    if (s_window_layer) {
      layer_mark_dirty(s_window_layer);
    }
  }

  Tuple *offset_tuple = dict_find(iter, MESSAGE_KEY_CaptureTimeOffset);
  if (offset_tuple && settings_get()->debug_mode) {
    int32_t offset = 0;
    if (offset_tuple->type == TUPLE_INT) {
      offset = offset_tuple->value->int32;
    }
    argus_time_set_offset(offset);
    weather_ensure_view_coverage();
    time_t now = argus_time_now();
    struct tm *tm_now = localtime(&now);
    if (tm_now) {
      prv_refresh_all_modules(tm_now);
    }
    return;
  }

  time_t now = argus_time_now();
  struct tm *tm_now = localtime(&now);
  if (tm_now) {
    prv_refresh_all_modules(tm_now);
  }

  if (request_weather) {
    weather_request_force();
  }
}

static void prv_inbox_dropped(AppMessageResult reason, void *context) {
  (void)context;
  APP_LOG(APP_LOG_LEVEL_WARNING, "Inbox dropped: %d", (int)reason);
  weather_mark_error();
  weather_schedule_retry();
  weather_chart_refresh(s_weather_chart);
}

static void prv_outbox_failed(DictionaryIterator *iter, AppMessageResult reason, void *context) {
  (void)iter;
  (void)context;
  APP_LOG(APP_LOG_LEVEL_WARNING, "Outbox failed: %d", (int)reason);
}

static void prv_battery_handler(BatteryChargeState state) {
  header_refresh_battery(s_header, state);
}

static void prv_bt_handler(bool connected) {
  header_refresh_bt(s_header, connected);
  weather_refresh_for_connection(connected);
  weather_chart_refresh(s_weather_chart);
}

static void prv_app_focus_handler(bool in_focus) {
  if (in_focus) {
    header_refresh_quiet_time(s_header, quiet_time_is_active());
  }
}

static void prv_window_load(Window *window) {
  s_window_layer = window_get_root_layer(window);
  Layer *root = s_window_layer;

  s_header = header_create(root);
  s_calendar = calendar_create(root);
  s_time_display = time_display_create(root);
  s_weather_chart = weather_chart_create(root);

  if (!s_header || !s_calendar || !s_time_display || !s_weather_chart) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Failed to create watchface modules");
    return;
  }

  time_t now = argus_time_now();
  struct tm *tm_now = localtime(&now);
  if (tm_now) {
    prv_refresh_all_modules(tm_now);
  }

  header_refresh_bt(s_header, connection_service_peek_pebble_app_connection());
  header_refresh_quiet_time(s_header, quiet_time_is_active());
  header_refresh_weather_status(s_header);
  header_refresh_battery(s_header, battery_state_service_peek());

  prv_update_layout();

  s_unobstructed_handlers = (UnobstructedAreaHandlers){
      .change = prv_unobstructed_change,
  };
  unobstructed_area_service_subscribe(s_unobstructed_handlers, NULL);
}

static void prv_window_unload(Window *window) {
  (void)window;
  unobstructed_area_service_unsubscribe();
  weather_chart_destroy(s_weather_chart);
  time_display_destroy(s_time_display);
  calendar_destroy(s_calendar);
  header_destroy(s_header);
  s_window_layer = NULL;
}

static void prv_weather_updated(void) {
  weather_chart_refresh(s_weather_chart);
  header_refresh_weather_status(s_header);
  if (settings_get()->header_display_mode == HEADER_DISPLAY_TEMP_RANGE) {
    header_invalidate(s_header);
    time_t now = argus_time_now();
    struct tm *tm_now = localtime(&now);
    if (tm_now) {
      header_update(s_header, tm_now);
    }
  }
}

#if defined(PBL_HEALTH)
static bool prv_should_run_hr_backfill(void) {
  const ArgusSettings *settings = settings_get();
  return settings->header_display_mode == HEADER_DISPLAY_HEART_RATE && !settings_use_demo_biometrics();
}

static void prv_sync_health_sampling(void) {
  const ArgusSettings *settings = settings_get();
  uint16_t period = 0;

  if (settings->header_display_mode == HEADER_DISPLAY_HEART_RATE) {
    if (settings->biometric_update_mode == BIOMETRIC_UPDATE_EVERY_MINUTE) {
      period = BIOMETRIC_SAMPLE_PERIOD_SEC;
    } else if (settings->biometric_update_mode == BIOMETRIC_UPDATE_LIVE) {
      period = BIOMETRIC_LIVE_SAMPLE_PERIOD_SEC;
    }
  }

  health_service_set_heart_rate_sample_period(period);
}

static void prv_refresh_biometric_header(void) {
  if (!s_header || !settings_header_shows_biometrics()) {
    return;
  }
  time_t now = argus_time_now();
  struct tm *tm_now = localtime(&now);
  if (tm_now) {
    header_refresh_biometrics(s_header, tm_now);
  }
}

static void prv_health_handler(HealthEventType event, void *context) {
  (void)context;
  const ArgusSettings *settings = settings_get();

  if (!settings_header_shows_biometrics()) {
    return;
  }

  switch (settings->biometric_update_mode) {
    case BIOMETRIC_UPDATE_OPTIMISED:
    case BIOMETRIC_UPDATE_EVERY_MINUTE:
      /* Every-minute mode also refreshes from the tick handler. */
      if (event != HealthEventSignificantUpdate) {
        return;
      }
      break;
    case BIOMETRIC_UPDATE_LIVE:
      if (settings->header_display_mode == HEADER_DISPLAY_HEART_RATE) {
        if (event != HealthEventHeartRateUpdate && event != HealthEventSignificantUpdate) {
          return;
        }
      } else if (event != HealthEventSignificantUpdate && event != HealthEventMovementUpdate) {
        return;
      }
      break;
    default:
      return;
  }

  prv_refresh_biometric_header();
}

static void prv_biometric_load_timer_cb(void *context) {
  (void)context;
  s_biometric_load_timer = NULL;
  prv_refresh_biometric_header();
}

static void prv_hr_backfill_chunk_timer_cb(void *context) {
  (void)context;
  s_hr_backfill_chunk_timer = NULL;

  if (!prv_should_run_hr_backfill()) {
    hr_day_backfill_cancel();
    return;
  }

  if (hr_day_backfill_chunk()) {
    prv_refresh_biometric_header();
    return;
  }

  s_hr_backfill_chunk_timer = app_timer_register(HR_BACKFILL_CHUNK_MS, prv_hr_backfill_chunk_timer_cb, NULL);
}

static void prv_hr_backfill_start_timer_cb(void *context) {
  (void)context;
  s_hr_backfill_start_timer = NULL;

  if (!prv_should_run_hr_backfill()) {
    return;
  }

  hr_day_backfill_start();
  s_hr_backfill_chunk_timer = app_timer_register(HR_BACKFILL_CHUNK_MS, prv_hr_backfill_chunk_timer_cb, NULL);
}

static void prv_cancel_hr_backfill(void) {
  if (s_hr_backfill_start_timer) {
    app_timer_cancel(s_hr_backfill_start_timer);
    s_hr_backfill_start_timer = NULL;
  }
  if (s_hr_backfill_chunk_timer) {
    app_timer_cancel(s_hr_backfill_chunk_timer);
    s_hr_backfill_chunk_timer = NULL;
  }
  hr_day_backfill_cancel();
}

static void prv_schedule_hr_backfill(void) {
  if (!prv_should_run_hr_backfill()) {
    prv_cancel_hr_backfill();
    return;
  }

  prv_cancel_hr_backfill();
  s_hr_backfill_start_timer = app_timer_register(HR_BACKFILL_START_DELAY_MS, prv_hr_backfill_start_timer_cb, NULL);
}

static void prv_schedule_biometric_load_refresh(void) {
  if (!settings_header_shows_biometrics()) {
    return;
  }
  if (s_biometric_load_timer) {
    app_timer_cancel(s_biometric_load_timer);
  }
  s_biometric_load_timer = app_timer_register(BIOMETRIC_LOAD_REFRESH_MS, prv_biometric_load_timer_cb, NULL);
}
#endif

static AppTimer *s_check_release_notice_timer;

static void prv_check_release_notice_timer_cb(void *context) {
  (void)context;
  s_check_release_notice_timer = NULL;

  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }

  dict_write_uint8(iter, MESSAGE_KEY_CheckReleaseNotice, 1);
  app_message_outbox_send();
}

static void prv_schedule_release_notice_check(void) {
  if (s_check_release_notice_timer) {
    app_timer_cancel(s_check_release_notice_timer);
  }
  s_check_release_notice_timer = app_timer_register(500, prv_check_release_notice_timer_cb, NULL);
}

static void init(void) {
  settings_init();
  weather_init();
  weather_set_updated_handler(prv_weather_updated);

  s_main_window = window_create();
  window_set_background_color(s_main_window, GColorBlack);
  window_set_window_handlers(s_main_window, (WindowHandlers){
      .load = prv_window_load,
      .unload = prv_window_unload,
  });
  window_stack_push(s_main_window, true);

  tick_timer_service_subscribe(MINUTE_UNIT | DAY_UNIT, prv_tick_handler);
  battery_state_service_subscribe(prv_battery_handler);
  connection_service_subscribe((ConnectionHandlers){
      .pebble_app_connection_handler = prv_bt_handler,
  });
  app_focus_service_subscribe_handlers((AppFocusHandlers){
      .did_focus = prv_app_focus_handler,
  });

  app_message_register_inbox_received(prv_inbox_received);
  app_message_register_inbox_dropped(prv_inbox_dropped);
  app_message_register_outbox_failed(prv_outbox_failed);
  app_message_open(app_message_inbox_size_maximum(), app_message_outbox_size_maximum());

#if defined(PBL_HEALTH)
  hr_day_init();
  health_service_events_subscribe(prv_health_handler, NULL);
  prv_sync_health_sampling();
  prv_schedule_biometric_load_refresh();
  prv_schedule_hr_backfill();
#endif

  weather_request_force();
  s_last_periodic_weather_refresh = argus_time_now();
  prv_holidays_request();

  prv_schedule_release_notice_check();
}

static void deinit(void) {
  if (s_check_release_notice_timer) {
    app_timer_cancel(s_check_release_notice_timer);
    s_check_release_notice_timer = NULL;
  }
#if defined(PBL_HEALTH)
  if (s_biometric_load_timer) {
    app_timer_cancel(s_biometric_load_timer);
    s_biometric_load_timer = NULL;
  }
  prv_cancel_hr_backfill();
  health_service_set_heart_rate_sample_period(0);
  health_service_events_unsubscribe();
#endif
  tick_timer_service_unsubscribe();
  battery_state_service_unsubscribe();
  connection_service_unsubscribe();
  app_focus_service_unsubscribe();
  window_destroy(s_main_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
  return 0;
}
