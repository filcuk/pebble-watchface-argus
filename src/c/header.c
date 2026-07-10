#include "header.h"

#include "argus_time.h"
#include "formatting.h"
#include "heart_icon.h"
#include "steps_icon.h"
#include "temp_icon.h"
#include "settings.h"
#include "weather.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

struct Header {
  Layer *container;
  Layer *bt_layer;
  Layer *battery_layer;
  Layer *status_layer;
  char status_text[24];
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

#if defined(PBL_HEALTH)
#define HR_HISTORY_WINDOW_SEC (2 * SECONDS_PER_HOUR)
#define DEMO_STEPS_COUNT 6000
#define DEMO_HR_CURRENT 80
#define DEMO_HR_MAX 120

static bool prv_valid_health_hr_bpm(HealthValue bpm) {
  return bpm >= HR_BPM_MIN && bpm <= HR_BPM_MAX;
}

static bool prv_hr_aggregate_available(time_t start, time_t end, HealthAggregation aggregation) {
  HealthServiceAccessibilityMask mask = health_service_metric_aggregate_averaged_accessible(
      HealthMetricHeartRateBPM, start, end, aggregation, HealthServiceTimeScopeOnce);
  return (mask & HealthServiceAccessibilityMaskAvailable) != 0;
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

static void prv_heart_rate_readings(HeartRateReadings *out, bool fetch_history_max) {
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

  if (prv_hr_aggregate_available(end, end, HealthAggregationAvg)) {
    HealthValue current = health_service_peek_current_value(HealthMetricHeartRateBPM);
    if (prv_valid_health_hr_bpm(current)) {
      out->current = (uint8_t)current;
      out->ready = true;
    }
  }

  uint8_t max_bpm = 0;

  if (fetch_history_max) {
    time_t history_start = end - HR_HISTORY_WINDOW_SEC;
    if (prv_hr_aggregate_available(history_start, end, HealthAggregationMax)) {
      HealthValue aggregate_max = health_service_aggregate_averaged(HealthMetricHeartRateBPM, history_start, end,
                                                                  HealthAggregationMax,
                                                                  HealthServiceTimeScopeOnce);
      if (prv_valid_health_hr_bpm(aggregate_max)) {
        max_bpm = (uint8_t)aggregate_max;
        out->ready = true;
      }
    }
  }

  if (out->current > max_bpm) {
    max_bpm = out->current;
  }
  if (max_bpm > 0) {
    out->max = max_bpm;
    out->ready = true;
  }
}
#endif

static void prv_format_full_date(char *buffer, size_t len, struct tm *now) {
  static char month_buf[8];
  strftime(month_buf, sizeof(month_buf), "%b", now);
  snprintf(buffer, len, "%d %s %d", now->tm_mday, month_buf, now->tm_year + 1900);
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

static void prv_sync_bt_visibility(Header *header) {
  layer_set_hidden(header->bt_layer, !prv_bt_should_show(header));
}

static void prv_status_layer_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Header *header = s_header;
  if (!header) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  int center_y = bounds.origin.y + bounds.size.h / 2;

  switch (header->status_mode) {
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
      char current_buf[8];
      char range_buf[16];
      if (header->status_temp_ready) {
        snprintf(current_buf, sizeof(current_buf), "%d", (int)header->status_temp_current);
        snprintf(range_buf, sizeof(range_buf), "(%d/%d)", (int)header->status_temp_min,
                 (int)header->status_temp_max);
      } else {
        snprintf(current_buf, sizeof(current_buf), "--");
        snprintf(range_buf, sizeof(range_buf), "(--/--)");
      }

      GSize current_size = prv_text_size(current_buf);
      GSize range_size = prv_text_size_font(range_buf, prv_status_font_regular());
      int total_w = TEMP_ICON_WIDTH + STATUS_ICON_GAP + current_size.w + STATUS_ICON_GAP + range_size.w;
      int x = bounds.origin.x + (bounds.size.w - total_w) / 2;
      int icon_y = center_y - TEMP_ICON_HEIGHT / 2 + STATUS_ICON_Y_OFFSET;

      temp_icon_draw(ctx, x, icon_y);
      x += TEMP_ICON_WIDTH + STATUS_ICON_GAP;
      prv_draw_text(ctx, current_buf, x, bounds);
      x += current_size.w + STATUS_ICON_GAP;
      prv_draw_text_font(ctx, range_buf, prv_status_font_regular(), x, bounds);
      break;
    }
    case HEADER_DISPLAY_HEART_RATE: {
      char current_buf[8];
      char max_buf[8];
      char max_display_buf[12];
      if (header->status_hr_ready && prv_valid_hr_bpm(header->status_hr_current)) {
        snprintf(current_buf, sizeof(current_buf), "%d", header->status_hr_current);
      } else {
        snprintf(current_buf, sizeof(current_buf), "--");
      }
      if (header->status_hr_ready && prv_valid_hr_bpm(header->status_hr_max)) {
        snprintf(max_buf, sizeof(max_buf), "%d", header->status_hr_max);
      } else {
        snprintf(max_buf, sizeof(max_buf), "--");
      }
      snprintf(max_display_buf, sizeof(max_display_buf), "(%s)", max_buf);

      GSize current_size = prv_text_size(current_buf);
      GSize max_size = prv_text_size_font(max_display_buf, prv_status_font_regular());
      int total_w = HEART_ICON_WIDTH + STATUS_ICON_GAP + current_size.w + STATUS_ICON_GAP + max_size.w;
      int x = bounds.origin.x + (bounds.size.w - total_w) / 2;
      int icon_y = center_y - HEART_ICON_HEIGHT / 2 + STATUS_ICON_Y_OFFSET;

      heart_icon_draw(ctx, x, icon_y);
      x += HEART_ICON_WIDTH + STATUS_ICON_GAP;
      prv_draw_text(ctx, current_buf, x, bounds);
      x += current_size.w + STATUS_ICON_GAP;
      prv_draw_text_font(ctx, max_display_buf, prv_status_font_regular(), x, bounds);
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
  (void)layer;
  Header *header = s_header;
  if (!header) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_stroke_color(ctx, GColorWhite);
  graphics_context_set_fill_color(ctx, header->bt_connected ? GColorWhite : GColorRed);

  int cx = bounds.size.w / 2;
  int cy = bounds.size.h / 2;
  if (header->bt_connected) {
    graphics_draw_circle(ctx, GPoint(cx, cy), 4);
    graphics_draw_line(ctx, GPoint(cx - 2, cy + 2), GPoint(cx + 2, cy - 2));
  } else {
    graphics_fill_circle(ctx, GPoint(cx, cy), 5);
    graphics_context_set_stroke_color(ctx, GColorBlack);
    graphics_draw_line(ctx, GPoint(cx - 3, cy - 3), GPoint(cx + 3, cy + 3));
    graphics_draw_line(ctx, GPoint(cx - 3, cy + 3), GPoint(cx + 3, cy - 3));
  }
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

  GRect bounds = layer_get_bounds(parent);
  header->container = layer_create(GRect(0, 0, bounds.size.w, HEADER_HEIGHT));
  layer_add_child(parent, header->container);

  header->bt_layer = layer_create(GRect(4, 2, 18, HEADER_HEIGHT - 4));
  layer_set_update_proc(header->bt_layer, prv_bt_update_proc);
  layer_add_child(header->container, header->bt_layer);

  header->battery_layer = layer_create(GRect(bounds.size.w - 28, 2, 24, HEADER_HEIGHT - 4));
  layer_set_update_proc(header->battery_layer, prv_battery_update_proc);
  layer_add_child(header->container, header->battery_layer);

  header->status_layer = layer_create(GRect(24, 0, bounds.size.w - 52, HEADER_HEIGHT));
  layer_set_update_proc(header->status_layer, prv_status_layer_update_proc);
  layer_add_child(header->container, header->status_layer);

  header->battery_percent = 100;
  header->bt_connected = true;
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
  layer_destroy(header->status_layer);
  layer_destroy(header->bt_layer);
  layer_destroy(header->battery_layer);
  layer_destroy(header->container);
  free(header);
}

void header_set_bounds(Header *header, GRect frame) {
  if (!header) {
    return;
  }
  layer_set_frame(header->container, frame);
  layer_set_frame(header->battery_layer, GRect(frame.size.w - 28, 2, 24, HEADER_HEIGHT - 4));
  layer_set_frame(header->status_layer, GRect(24, 0, frame.size.w - 52, HEADER_HEIGHT));
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
  prv_sync_bt_visibility(header);
  if (!layer_get_hidden(header->bt_layer)) {
    layer_mark_dirty(header->bt_layer);
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
    if (mode == HEADER_DISPLAY_STEPS || mode == HEADER_DISPLAY_TEMP_RANGE || mode == HEADER_DISPLAY_HEART_RATE) {
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
      const WeatherData *data = weather_get();
      if (data && data->state == WEATHER_STATE_READY) {
        WeatherView view;
        weather_get_view(&view);
        if (weather_view_has_data(&view)) {
          temp_ready = true;
          temp_current = formatting_display_temp(weather_display_temp_at(view.start_index));
          temp_min = formatting_display_temp(weather_display_temp_min());
          temp_max = formatting_display_temp(weather_display_temp_max());
        }
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
    }
  } else if (mode == HEADER_DISPLAY_HEART_RATE) {
    changed = changed || force;
  }

  if (changed) {
    layer_mark_dirty(header->status_layer);
  }
}

void header_refresh_biometrics(Header *header, struct tm *now, bool fetch_hr_history) {
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
    prv_heart_rate_readings(&hr, fetch_hr_history);
    changed = header->status_hr_ready != hr.ready || header->status_hr_current != hr.current ||
              header->status_hr_max != hr.max;
    if (changed) {
      header->status_hr_ready = hr.ready;
      header->status_hr_current = hr.current;
      header->status_hr_max = hr.max;
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
  header->bt_connected = connected;
  prv_sync_bt_visibility(header);
  if (!layer_get_hidden(header->bt_layer)) {
    layer_mark_dirty(header->bt_layer);
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
