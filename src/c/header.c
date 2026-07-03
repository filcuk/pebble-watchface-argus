#include "header.h"

#include "settings.h"
#include "weather.h"

#include <stdio.h>
#include <time.h>

struct Header {
  Layer *container;
  Layer *bt_layer;
  Layer *battery_layer;
  Layer *status_layer;
  char status_text[24];
  HeaderDisplayMode status_mode;
  bool status_temp_ready;
  int8_t status_temp_min;
  int8_t status_temp_max;
  int battery_percent;
  bool bt_connected;
};

static Header *s_header;

static int8_t prv_display_temp(int8_t celsius) {
  const ArgusSettings *settings = settings_get();
  if (!settings->temperature_fahrenheit) {
    return celsius;
  }
  return (int8_t)(((celsius * 9) + (celsius >= 0 ? 2 : -2)) / 5 + 32);
}

#if defined(PBL_HEALTH)
static int prv_today_steps(void) {
  HealthMetric metric = HealthMetricStepCount;
  time_t start = time_start_of_today();
  time_t end = time(NULL);
  HealthServiceAccessibilityMask mask = health_service_metric_accessible(metric, start, end);
  if (mask & HealthServiceAccessibilityMaskAvailable) {
    return (int)health_service_sum(metric, start, end);
  }
  return -1;
}
#endif

static void prv_format_full_date(char *buffer, size_t len, struct tm *now) {
  static char month_buf[8];
  strftime(month_buf, sizeof(month_buf), "%b", now);
  snprintf(buffer, len, "%d %s %d", now->tm_mday, month_buf, now->tm_year + 1900);
}

static void prv_format_steps(char *buffer, size_t len) {
#if defined(PBL_HEALTH)
  int steps = prv_today_steps();
  if (steps >= 0) {
    snprintf(buffer, len, "%d", steps);
    return;
  }
#endif
  snprintf(buffer, len, "--");
}

#define STATUS_ICON_GAP 3
#define ARROW_WIDTH 8
#define ARROW_HEIGHT 8

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

static void prv_draw_up_arrow(GContext *ctx, int cx, int cy) {
  GPoint points[] = {
      GPoint(cx, cy - 4),
      GPoint(cx - 4, cy + 3),
      GPoint(cx + 4, cy + 3),
  };
  GPathInfo path_info = {
      .num_points = 3,
      .points = points,
  };
  GPath *path = gpath_create(&path_info);
  graphics_context_set_fill_color(ctx, GColorWhite);
  gpath_draw_filled(ctx, path);
  gpath_destroy(path);
}

static void prv_draw_down_arrow(GContext *ctx, int cx, int cy) {
  GPoint points[] = {
      GPoint(cx, cy + 4),
      GPoint(cx - 4, cy - 3),
      GPoint(cx + 4, cy - 3),
  };
  GPathInfo path_info = {
      .num_points = 3,
      .points = points,
  };
  GPath *path = gpath_create(&path_info);
  graphics_context_set_fill_color(ctx, GColorWhite);
  gpath_draw_filled(ctx, path);
  gpath_destroy(path);
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
      GSize suffix_size = prv_text_size_font(" steps", prv_status_font_regular());
      int total_w = count_size.w + suffix_size.w;
      int x = bounds.origin.x + (bounds.size.w - total_w) / 2;
      prv_draw_text(ctx, header->status_text, x, bounds);
      prv_draw_text_font(ctx, " steps", prv_status_font_regular(), x + count_size.w, bounds);
      break;
    }
    case HEADER_DISPLAY_TEMP_RANGE: {
      char min_buf[8];
      char max_buf[8];
      if (header->status_temp_ready) {
        snprintf(min_buf, sizeof(min_buf), "%d", (int)header->status_temp_min);
        snprintf(max_buf, sizeof(max_buf), "%d", (int)header->status_temp_max);
      } else {
        snprintf(min_buf, sizeof(min_buf), "--");
        snprintf(max_buf, sizeof(max_buf), "--");
      }

      GSize min_size = prv_text_size(min_buf);
      GSize sep_size = prv_text_size(" / ");
      GSize max_size = prv_text_size(max_buf);
      int total_w = ARROW_WIDTH + STATUS_ICON_GAP + max_size.w + sep_size.w + ARROW_WIDTH + STATUS_ICON_GAP +
                    min_size.w;
      int x = bounds.origin.x + (bounds.size.w - total_w) / 2;

      prv_draw_up_arrow(ctx, x + ARROW_WIDTH / 2, center_y);
      x += ARROW_WIDTH + STATUS_ICON_GAP;
      prv_draw_text(ctx, max_buf, x, bounds);
      x += max_size.w;
      prv_draw_text(ctx, " / ", x, bounds);
      x += sep_size.w;
      prv_draw_down_arrow(ctx, x + ARROW_WIDTH / 2, center_y);
      x += ARROW_WIDTH + STATUS_ICON_GAP;
      prv_draw_text(ctx, min_buf, x, bounds);
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
  const ArgusSettings *settings = settings_get();
  bool show = settings->bluetooth_display == BT_DISPLAY_ALWAYS || !header->bt_connected;
  if (!show) {
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
  s_header = header;
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

void header_update(Header *header, struct tm *now) {
  if (!header || !now) {
    return;
  }

  const ArgusSettings *settings = settings_get();
  header->status_mode = settings->header_display_mode;
  header->status_temp_ready = false;

  switch (settings->header_display_mode) {
    case HEADER_DISPLAY_STEPS:
      prv_format_steps(header->status_text, sizeof(header->status_text));
      break;
    case HEADER_DISPLAY_TEMP_RANGE: {
      const WeatherData *data = weather_get();
      if (data && data->state == WEATHER_STATE_READY) {
        header->status_temp_ready = true;
        header->status_temp_min = prv_display_temp(data->temp_min);
        header->status_temp_max = prv_display_temp(data->temp_max);
      }
      break;
    }
    case HEADER_DISPLAY_FULL_DATE:
    default:
      prv_format_full_date(header->status_text, sizeof(header->status_text), now);
      break;
  }

  layer_mark_dirty(header->status_layer);
}

void header_refresh_bt(Header *header, bool connected) {
  if (!header) {
    return;
  }
  header->bt_connected = connected;
  layer_mark_dirty(header->bt_layer);
}

void header_refresh_battery(Header *header, BatteryChargeState state) {
  if (!header) {
    return;
  }
  header->battery_percent = state.charge_percent;
  layer_mark_dirty(header->battery_layer);
}
