#include "header.h"

#include "argus_time.h"
#include "formatting.h"
#include "bt_icon.h"
#include "heart_icon.h"
#include "hr_day.h"
#include "quiet_mode_icon.h"
#include "steps_icon.h"
#include "temp_icon.h"
#include "weather_status_icon.h"
#include "settings.h"
#include "weather.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

struct Header {
  Layer *container;
  Layer *bt_layer;
  Layer *quiet_layer;
  Layer *weather_layer;
  Layer *battery_layer;
  Layer *status_layer;
  char status_text[24];
  char status_temp_current_text[8];
  char status_temp_range_text[16];
  char status_hr_current_text[8];
  char status_hr_max_text[12];
  HeaderDisplayMode status_mode;
  bool status_temp_ready;
  int8_t status_temp_current;
  int8_t status_temp_min;
  int8_t status_temp_max;
  bool status_hr_ready;
  uint8_t status_hr_current;
  uint8_t status_hr_max;
  int battery_percent;
  bool bt_connected;
  bool quiet_time_active;
  WeatherStatusIconKind weather_status_kind;
  bool force_dirty;
  int last_year;
  int last_mon;
  int last_mday;
  int last_steps_count;
};

static Header *s_header;

#define HR_BPM_MIN 30
#define HR_BPM_MAX 220

static bool prv_valid_hr_bpm(uint8_t bpm) {
  return bpm >= HR_BPM_MIN && bpm <= HR_BPM_MAX;
}

static void prv_format_temp_status_texts(Header *header) {
  if (header->status_temp_ready) {
    snprintf(header->status_temp_current_text, sizeof(header->status_temp_current_text), "%d",
             (int)header->status_temp_current);
    snprintf(header->status_temp_range_text, sizeof(header->status_temp_range_text), "(%d/%d)",
             (int)header->status_temp_min, (int)header->status_temp_max);
  } else {
    snprintf(header->status_temp_current_text, sizeof(header->status_temp_current_text), "--");
    snprintf(header->status_temp_range_text, sizeof(header->status_temp_range_text), "(--/--)");
  }
}

static void prv_format_hr_status_texts(Header *header) {
  if (header->status_hr_ready && prv_valid_hr_bpm(header->status_hr_current)) {
    snprintf(header->status_hr_current_text, sizeof(header->status_hr_current_text), "%d",
             header->status_hr_current);
  } else {
    snprintf(header->status_hr_current_text, sizeof(header->status_hr_current_text), "--");
  }
  if (header->status_hr_ready && prv_valid_hr_bpm(header->status_hr_max)) {
    snprintf(header->status_hr_max_text, sizeof(header->status_hr_max_text), "(%d)", header->status_hr_max);
  } else {
    snprintf(header->status_hr_max_text, sizeof(header->status_hr_max_text), "(--)");
  }
}

#if defined(PBL_HEALTH)
#define DEMO_STEPS_COUNT 6000
#define DEMO_HR_CURRENT 80
#define DEMO_HR_MAX 120

static bool prv_valid_health_hr_bpm(HealthValue bpm) {
  return bpm >= HR_BPM_MIN && bpm <= HR_BPM_MAX;
}

static int prv_today_steps(void) {
  if (settings_use_demo_biometrics()) {
    return DEMO_STEPS_COUNT;
  }

  HealthMetric metric = HealthMetricStepCount;
  time_t start = time_start_of_today();
  time_t end = argus_time_now();
  HealthServiceAccessibilityMask mask = health_service_metric_accessible(metric, start, end);
  if (mask & HealthServiceAccessibilityMaskAvailable) {
    return (int)health_service_sum(metric, start, end);
  }
  return -1;
}

typedef struct {
  bool ready;
  uint8_t current;
  uint8_t max;
} HeartRateReadings;

static void prv_heart_rate_readings(HeartRateReadings *out) {
  out->ready = false;
  out->current = 0;
  out->max = 0;

  if (settings_use_demo_biometrics()) {
    out->ready = true;
    out->current = DEMO_HR_CURRENT;
    out->max = DEMO_HR_MAX;
    return;
  }

  time_t end = argus_time_now();
  HealthServiceAccessibilityMask mask =
      health_service_metric_accessible(HealthMetricHeartRateBPM, end, end);
  if (mask & HealthServiceAccessibilityMaskAvailable) {
    HealthValue current = health_service_peek_current_value(HealthMetricHeartRateBPM);
    if (prv_valid_health_hr_bpm(current)) {
      out->current = (uint8_t)current;
      out->ready = true;
      hr_day_record(out->current);
    }
  }

  uint8_t max_bpm = hr_day_max();
  if (max_bpm > 0) {
    out->max = max_bpm;
    out->ready = true;
  }
}
#endif

static void prv_format_full_date(char *buffer, size_t len, struct tm *now) {
  uint16_t year = (uint16_t)(now->tm_year + 1900);
  uint8_t month = (uint8_t)(now->tm_mon + 1);
  uint8_t day = (uint8_t)now->tm_mday;

  switch (settings_get()->full_date_format) {
    case FULL_DATE_FORMAT_MMM_D_YYYY: {
      char month_buf[8];
      strftime(month_buf, sizeof(month_buf), "%b", now);
      snprintf(buffer, len, "%s %u %u", month_buf, (unsigned)day, (unsigned)year);
      break;
    }
    case FULL_DATE_FORMAT_DD_MM_YYYY:
      snprintf(buffer, len, "%02u-%02u-%u", (unsigned)day, (unsigned)month, (unsigned)year);
      break;
    case FULL_DATE_FORMAT_MM_DD_YYYY:
      snprintf(buffer, len, "%02u-%02u-%u", (unsigned)month, (unsigned)day, (unsigned)year);
      break;
    case FULL_DATE_FORMAT_YYYY_MM_DD:
      snprintf(buffer, len, "%u-%02u-%02u", (unsigned)year, (unsigned)month, (unsigned)day);
      break;
    case FULL_DATE_FORMAT_D_MMM_YYYY:
    default: {
      char month_buf[8];
      strftime(month_buf, sizeof(month_buf), "%b", now);
      snprintf(buffer, len, "%u %s %u", (unsigned)day, month_buf, (unsigned)year);
      break;
    }
  }
}

static void prv_format_steps(char *buffer, size_t len, int *steps_out) {
#if defined(PBL_HEALTH)
  int steps = prv_today_steps();
  if (steps_out) {
    *steps_out = steps;
  }
  if (steps >= 0) {
    formatting_format_grouped_int(buffer, len, steps);
    return;
  }
#endif
  if (steps_out) {
    *steps_out = -1;
  }
  snprintf(buffer, len, "--");
}

#define STATUS_ICON_GAP 3
#define STATUS_ICON_Y_OFFSET 1
#define HEADER_ICON_Y 2
#define HEADER_ICON_H (HEADER_HEIGHT - 4)
#define HEADER_ICONS_LEFT 4
#define HEADER_ICON_GAP 2
#define HEADER_STATUS_MIN_LEFT 28
#define HEADER_BATTERY_WIDTH 28

static GFont prv_status_font_bold(void) {
  return fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
}

static GFont prv_status_font_regular(void) {
  return fonts_get_system_font(FONT_KEY_GOTHIC_18);
}

static GSize prv_text_size_font(const char *text, GFont font) {
  return graphics_text_layout_get_content_size(text, font, GRect(0, 0, 200, HEADER_HEIGHT),
                                               GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
}

static GSize prv_text_size(const char *text) {
  return prv_text_size_font(text, prv_status_font_bold());
}

static void prv_draw_text_font(GContext *ctx, const char *text, GFont font, int x, GRect bounds) {
  GSize size = prv_text_size_font(text, font);
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, text, font, GRect(x, bounds.origin.y, size.w + 2, bounds.size.h),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

static void prv_draw_text(GContext *ctx, const char *text, int x, GRect bounds) {
  prv_draw_text_font(ctx, text, prv_status_font_bold(), x, bounds);
}

static bool prv_bt_should_show(const Header *header) {
  const ArgusSettings *settings = settings_get();
  return settings->bluetooth_display == BT_DISPLAY_ALWAYS || !header->bt_connected;
}

static bool prv_quiet_should_show(const Header *header) {
  const ArgusSettings *settings = settings_get();
  return settings->quiet_mode_display && header->quiet_time_active;
}

static void prv_layout_header_icons(Header *header, int header_width) {
  bool show_bt = prv_bt_should_show(header);
  bool show_quiet = prv_quiet_should_show(header);
  bool show_weather = header->weather_status_kind != WEATHER_STATUS_ICON_NONE;
  int x = HEADER_ICONS_LEFT;

  if (show_bt) {
    layer_set_hidden(header->bt_layer, false);
    layer_set_frame(header->bt_layer, GRect(x, HEADER_ICON_Y, BT_ICON_WIDTH, HEADER_ICON_H));
    x += BT_ICON_WIDTH + HEADER_ICON_GAP;
  } else {
    layer_set_hidden(header->bt_layer, true);
  }

  if (show_quiet) {
    layer_set_hidden(header->quiet_layer, false);
    layer_set_frame(header->quiet_layer, GRect(x, HEADER_ICON_Y, QUIET_MODE_ICON_WIDTH, HEADER_ICON_H));
    x += QUIET_MODE_ICON_WIDTH + HEADER_ICON_GAP;
  } else {
    layer_set_hidden(header->quiet_layer, true);
  }

  if (show_weather) {
    layer_set_hidden(header->weather_layer, false);
    layer_set_frame(header->weather_layer,
                    GRect(x, HEADER_ICON_Y, WEATHER_STATUS_ICON_WIDTH, HEADER_ICON_H));
    x += WEATHER_STATUS_ICON_WIDTH + HEADER_ICON_GAP;
  } else {
    layer_set_hidden(header->weather_layer, true);
  }

  int status_left = (show_bt || show_quiet || show_weather) ? x + 2 : HEADER_STATUS_MIN_LEFT;
  layer_set_frame(header->status_layer,
                  GRect(status_left, 0, header_width - status_left - HEADER_BATTERY_WIDTH, HEADER_HEIGHT));
}

static void prv_sync_bt_visibility(Header *header) {
  prv_layout_header_icons(header, layer_get_bounds(header->container).size.w);
}

static void prv_status_layer_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Header *header = s_header;
  if (!header) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  int center_y = bounds.origin.y + bounds.size.h / 2;
  HeaderDisplayMode mode = settings_get()->header_display_mode;

  switch (mode) {
    case HEADER_DISPLAY_STEPS: {
      GSize count_size = prv_text_size(header->status_text);
      int total_w = STEPS_ICON_WIDTH + STATUS_ICON_GAP + count_size.w;
      int x = bounds.origin.x + (bounds.size.w - total_w) / 2;
      int icon_y = center_y - STEPS_ICON_HEIGHT / 2 + STATUS_ICON_Y_OFFSET;

      steps_icon_draw(ctx, x, icon_y);
      x += STEPS_ICON_WIDTH + STATUS_ICON_GAP;
      prv_draw_text(ctx, header->status_text, x, bounds);
      break;
    }
    case HEADER_DISPLAY_TEMP_RANGE: {
      GSize current_size = prv_text_size(header->status_temp_current_text);
      GSize range_size = prv_text_size_font(header->status_temp_range_text, prv_status_font_regular());
      int total_w = TEMP_ICON_WIDTH + STATUS_ICON_GAP + current_size.w + STATUS_ICON_GAP + range_size.w;
      int x = bounds.origin.x + (bounds.size.w - total_w) / 2;
      int icon_y = center_y - TEMP_ICON_HEIGHT / 2 + STATUS_ICON_Y_OFFSET;

      temp_icon_draw(ctx, x, icon_y);
      x += TEMP_ICON_WIDTH + STATUS_ICON_GAP;
      prv_draw_text(ctx, header->status_temp_current_text, x, bounds);
      x += current_size.w + STATUS_ICON_GAP;
      prv_draw_text_font(ctx, header->status_temp_range_text, prv_status_font_regular(), x, bounds);
      break;
    }
    case HEADER_DISPLAY_HEART_RATE: {
      GSize current_size = prv_text_size(header->status_hr_current_text);
      GSize max_size = prv_text_size_font(header->status_hr_max_text, prv_status_font_regular());
      int total_w = HEART_ICON_WIDTH + STATUS_ICON_GAP + current_size.w + STATUS_ICON_GAP + max_size.w;
      int x = bounds.origin.x + (bounds.size.w - total_w) / 2;
      int icon_y = center_y - HEART_ICON_HEIGHT / 2 + STATUS_ICON_Y_OFFSET;

      heart_icon_draw(ctx, x, icon_y);
      x += HEART_ICON_WIDTH + STATUS_ICON_GAP;
      prv_draw_text(ctx, header->status_hr_current_text, x, bounds);
      x += current_size.w + STATUS_ICON_GAP;
      prv_draw_text_font(ctx, header->status_hr_max_text, prv_status_font_regular(), x, bounds);
      break;
    }
    case HEADER_DISPLAY_FULL_DATE:
    default: {
      GSize text_size = prv_text_size(header->status_text);
      int x = bounds.origin.x + (bounds.size.w - text_size.w) / 2;
      prv_draw_text(ctx, header->status_text, x, bounds);
      break;
    }
  }
}

static void prv_bt_update_proc(Layer *layer, GContext *ctx) {
  Header *header = s_header;
  if (!header) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  int x = (bounds.size.w - BT_ICON_WIDTH) / 2;
  int y = (bounds.size.h - BT_ICON_HEIGHT) / 2;

  if (header->bt_connected) {
    bt_icon_draw_connected(ctx, x, y);
  } else {
    bt_icon_draw_lost(ctx, x, y);
  }
}

static void prv_quiet_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Header *header = s_header;
  if (!header) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  int x = (bounds.size.w - QUIET_MODE_ICON_WIDTH) / 2;
  int y = (bounds.size.h - QUIET_MODE_ICON_HEIGHT) / 2;
  quiet_mode_icon_draw(ctx, x, y);
}

static void prv_weather_status_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Header *header = s_header;
  if (!header) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  int x = (bounds.size.w - WEATHER_STATUS_ICON_WIDTH) / 2;
  int y = (bounds.size.h - WEATHER_STATUS_ICON_HEIGHT) / 2;
  weather_status_icon_draw(ctx, x, y, header->weather_status_kind);
}

static void prv_battery_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Header *header = s_header;
  GRect bounds = layer_get_bounds(layer);

  graphics_context_set_stroke_color(ctx, GColorWhite);
  graphics_draw_round_rect(ctx, GRect(0, 2, bounds.size.w - 3, bounds.size.h - 4), 2);
  graphics_draw_line(ctx, GPoint(bounds.size.w - 2, 5), GPoint(bounds.size.w - 2, bounds.size.h - 5));

  int fill_w = ((header->battery_percent * (bounds.size.w - 7)) / 100);
  if (fill_w < 0) {
    fill_w = 0;
  }

  GColor fill = GColorGreen;
  if (header->battery_percent <= 20) {
    fill = GColorRed;
  } else if (header->battery_percent <= 40) {
    fill = GColorChromeYellow;
  }

  graphics_context_set_fill_color(ctx, fill);
  graphics_fill_rect(ctx, GRect(2, 4, fill_w, bounds.size.h - 8), 1, GCornerNone);
}

Header *header_create(Layer *parent) {
  Header *header = malloc(sizeof(Header));
  if (!header) {
    return NULL;
  }
  memset(header, 0, sizeof(*header));

  GRect bounds = layer_get_bounds(parent);
  header->container = layer_create(GRect(0, 0, bounds.size.w, HEADER_HEIGHT));
  if (!header->container) {
    free(header);
    return NULL;
  }
  layer_add_child(parent, header->container);

  header->bt_layer = layer_create(GRect(HEADER_ICONS_LEFT, HEADER_ICON_Y, BT_ICON_WIDTH, HEADER_ICON_H));
  header->quiet_layer =
      layer_create(GRect(HEADER_ICONS_LEFT, HEADER_ICON_Y, QUIET_MODE_ICON_WIDTH, HEADER_ICON_H));
  header->weather_layer =
      layer_create(GRect(HEADER_ICONS_LEFT, HEADER_ICON_Y, WEATHER_STATUS_ICON_WIDTH, HEADER_ICON_H));
  header->battery_layer = layer_create(GRect(bounds.size.w - HEADER_BATTERY_WIDTH, 2, 24, HEADER_HEIGHT - 4));
  header->status_layer = layer_create(GRect(HEADER_STATUS_MIN_LEFT, 0, bounds.size.w - HEADER_STATUS_MIN_LEFT - HEADER_BATTERY_WIDTH,
                                          HEADER_HEIGHT));
  if (!header->bt_layer || !header->quiet_layer || !header->weather_layer || !header->battery_layer ||
      !header->status_layer) {
    header_destroy(header);
    return NULL;
  }

  layer_set_update_proc(header->bt_layer, prv_bt_update_proc);
  layer_add_child(header->container, header->bt_layer);
  layer_set_update_proc(header->quiet_layer, prv_quiet_update_proc);
  layer_add_child(header->container, header->quiet_layer);
  layer_set_update_proc(header->weather_layer, prv_weather_status_update_proc);
  layer_set_hidden(header->weather_layer, true);
  layer_add_child(header->container, header->weather_layer);
  layer_set_update_proc(header->battery_layer, prv_battery_update_proc);
  layer_add_child(header->container, header->battery_layer);
  layer_set_update_proc(header->status_layer, prv_status_layer_update_proc);
  layer_add_child(header->container, header->status_layer);

  header->battery_percent = 100;
  header->bt_connected = true;
  header->quiet_time_active = false;
  header->weather_status_kind = WEATHER_STATUS_ICON_NONE;
  header->force_dirty = true;
  header->last_year = -1;
  header->last_mon = -1;
  header->last_mday = -1;
  header->last_steps_count = -2;
  header->status_text[0] = '\0';
  header->status_mode = HEADER_DISPLAY_FULL_DATE;
  header->status_temp_ready = false;
  header->status_temp_current = 0;
  header->status_temp_min = 0;
  header->status_temp_max = 0;
  header->status_hr_ready = false;
  header->status_hr_current = 0;
  header->status_hr_max = 0;
  prv_format_temp_status_texts(header);
  prv_format_hr_status_texts(header);
  s_header = header;
  prv_sync_bt_visibility(header);
  return header;
}

void header_destroy(Header *header) {
  if (!header) {
    return;
  }
  if (s_header == header) {
    s_header = NULL;
  }
  if (header->status_layer) {
    layer_destroy(header->status_layer);
  }
  if (header->weather_layer) {
    layer_destroy(header->weather_layer);
  }
  if (header->quiet_layer) {
    layer_destroy(header->quiet_layer);
  }
  if (header->bt_layer) {
    layer_destroy(header->bt_layer);
  }
  if (header->battery_layer) {
    layer_destroy(header->battery_layer);
  }
  if (header->container) {
    layer_destroy(header->container);
  }
  free(header);
}

void header_set_bounds(Header *header, GRect frame) {
  if (!header) {
    return;
  }
  layer_set_frame(header->container, frame);
  layer_set_frame(header->battery_layer, GRect(frame.size.w - HEADER_BATTERY_WIDTH, 2, 24, HEADER_HEIGHT - 4));
  prv_layout_header_icons(header, frame.size.w);
}

void header_invalidate(Header *header) {
  if (!header) {
    return;
  }
  header->force_dirty = true;
}

void header_apply_settings(Header *header) {
  if (!header) {
    return;
  }
  header_refresh_weather_status(header);
  prv_sync_bt_visibility(header);
  if (!layer_get_hidden(header->bt_layer)) {
    layer_mark_dirty(header->bt_layer);
  }
  if (!layer_get_hidden(header->quiet_layer)) {
    layer_mark_dirty(header->quiet_layer);
  }
  if (!layer_get_hidden(header->weather_layer)) {
    layer_mark_dirty(header->weather_layer);
  }
}

void header_update(Header *header, struct tm *now) {
  if (!header || !now) {
    return;
  }

  const ArgusSettings *settings = settings_get();
  HeaderDisplayMode mode = settings->header_display_mode;
  HeaderDisplayMode old_mode = header->status_mode;
  bool force = header->force_dirty;

  if (!force) {
    if (mode == HEADER_DISPLAY_STEPS || mode == HEADER_DISPLAY_HEART_RATE) {
      return;
    }
    if (mode == HEADER_DISPLAY_FULL_DATE && header->last_year == now->tm_year && header->last_mon == now->tm_mon &&
        header->last_mday == now->tm_mday) {
      return;
    }
  }

  header->force_dirty = false;
  header->status_mode = mode;

  char new_text[sizeof(header->status_text)];
  new_text[0] = '\0';
  bool temp_ready = false;
  int8_t temp_current = 0;
  int8_t temp_min = 0;
  int8_t temp_max = 0;

  switch (mode) {
    case HEADER_DISPLAY_STEPS:
      strncpy(new_text, header->status_text, sizeof(new_text) - 1);
      new_text[sizeof(new_text) - 1] = '\0';
      break;
    case HEADER_DISPLAY_TEMP_RANGE: {
      WeatherView view;
      weather_get_view(&view);
      if (weather_view_has_data(&view)) {
        temp_ready = true;
        temp_current = formatting_display_temp(weather_display_temp_at(view.start_index));
        temp_min = formatting_display_temp(weather_display_temp_min_for_view(&view));
        temp_max = formatting_display_temp(weather_display_temp_max_for_view(&view));
      }
      break;
    }
    case HEADER_DISPLAY_HEART_RATE:
      break;
    case HEADER_DISPLAY_FULL_DATE:
    default:
      prv_format_full_date(new_text, sizeof(new_text), now);
      break;
  }

  bool changed = force || old_mode != mode;
  if (mode == HEADER_DISPLAY_FULL_DATE) {
    changed = changed || strcmp(header->status_text, new_text) != 0;
    if (changed) {
      strncpy(header->status_text, new_text, sizeof(header->status_text) - 1);
      header->status_text[sizeof(header->status_text) - 1] = '\0';
      header->last_year = now->tm_year;
      header->last_mon = now->tm_mon;
      header->last_mday = now->tm_mday;
    }
  } else if (mode == HEADER_DISPLAY_STEPS) {
    changed = changed || strcmp(header->status_text, new_text) != 0;
    if (changed && new_text[0] != '\0') {
      strncpy(header->status_text, new_text, sizeof(header->status_text) - 1);
      header->status_text[sizeof(header->status_text) - 1] = '\0';
    }
  } else if (mode == HEADER_DISPLAY_TEMP_RANGE) {
    changed = changed || header->status_temp_ready != temp_ready || header->status_temp_current != temp_current ||
              header->status_temp_min != temp_min || header->status_temp_max != temp_max;
    if (changed) {
      header->status_temp_ready = temp_ready;
      header->status_temp_current = temp_current;
      header->status_temp_min = temp_min;
      header->status_temp_max = temp_max;
      prv_format_temp_status_texts(header);
    }
  } else if (mode == HEADER_DISPLAY_HEART_RATE) {
    changed = changed || force;
    if (changed) {
      prv_format_hr_status_texts(header);
    }
  }

  if (changed) {
    layer_mark_dirty(header->status_layer);
  }
}

void header_refresh_biometrics(Header *header, struct tm *now) {
  if (!header || !now) {
    return;
  }

  const ArgusSettings *settings = settings_get();
  HeaderDisplayMode mode = settings->header_display_mode;

  if (mode != HEADER_DISPLAY_STEPS && mode != HEADER_DISPLAY_HEART_RATE) {
    return;
  }

  header->status_mode = mode;
  bool changed = false;

  if (mode == HEADER_DISPLAY_STEPS) {
#if defined(PBL_HEALTH)
    char new_text[sizeof(header->status_text)];
    int steps_count = header->last_steps_count;
    prv_format_steps(new_text, sizeof(new_text), &steps_count);
    changed = steps_count != header->last_steps_count || strcmp(header->status_text, new_text) != 0;
    if (changed) {
      strncpy(header->status_text, new_text, sizeof(header->status_text) - 1);
      header->status_text[sizeof(header->status_text) - 1] = '\0';
      header->last_steps_count = steps_count;
    }
#endif
  } else if (mode == HEADER_DISPLAY_HEART_RATE) {
#if defined(PBL_HEALTH)
    HeartRateReadings hr;
    prv_heart_rate_readings(&hr);
    changed = header->status_hr_ready != hr.ready || header->status_hr_current != hr.current ||
              header->status_hr_max != hr.max;
    if (changed) {
      header->status_hr_ready = hr.ready;
      header->status_hr_current = hr.current;
      header->status_hr_max = hr.max;
      prv_format_hr_status_texts(header);
    }
#endif
  }

  if (changed) {
    layer_mark_dirty(header->status_layer);
  }
}

void header_refresh_bt(Header *header, bool connected) {
  if (!header) {
    return;
  }
  if (header->bt_connected == connected) {
    return;
  }
  bool was_visible = prv_bt_should_show(header);
  header->bt_connected = connected;
  bool is_visible = prv_bt_should_show(header);
  prv_sync_bt_visibility(header);
  if (was_visible != is_visible || is_visible) {
    layer_mark_dirty(header->bt_layer);
  }
}

void header_refresh_quiet_time(Header *header, bool active) {
  if (!header) {
    return;
  }
  if (header->quiet_time_active == active) {
    return;
  }
  bool was_visible = prv_quiet_should_show(header);
  header->quiet_time_active = active;
  bool is_visible = prv_quiet_should_show(header);
  prv_sync_bt_visibility(header);
  if (was_visible != is_visible || is_visible) {
    layer_mark_dirty(header->quiet_layer);
  }
}

void header_refresh_weather_status(Header *header) {
  if (!header) {
    return;
  }

  WeatherStatusIconKind kind = weather_status_icon_kind();
  if (header->weather_status_kind == kind) {
    return;
  }
  bool was_visible = header->weather_status_kind != WEATHER_STATUS_ICON_NONE;
  header->weather_status_kind = kind;
  bool is_visible = kind != WEATHER_STATUS_ICON_NONE;
  prv_sync_bt_visibility(header);
  if (was_visible != is_visible || is_visible) {
    layer_mark_dirty(header->weather_layer);
  }
}

void header_refresh_battery(Header *header, BatteryChargeState state) {
  if (!header) {
    return;
  }
  if (header->battery_percent == state.charge_percent) {
    return;
  }
  header->battery_percent = state.charge_percent;
  layer_mark_dirty(header->battery_layer);
}
