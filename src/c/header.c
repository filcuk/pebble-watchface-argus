#include "header.h"

#include "settings.h"

#include <stdio.h>
#include <time.h>

struct Header {
  Layer *container;
  Layer *bt_layer;
  Layer *battery_layer;
  TextLayer *status_text;
  int battery_percent;
  bool bt_connected;
};

static Header *s_header;

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

  header->status_text = text_layer_create(GRect(24, 0, bounds.size.w - 52, HEADER_HEIGHT));
  text_layer_set_background_color(header->status_text, GColorClear);
  text_layer_set_text_color(header->status_text, GColorWhite);
  text_layer_set_font(header->status_text, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(header->status_text, GTextAlignmentCenter);
  layer_add_child(header->container, text_layer_get_layer(header->status_text));

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
  text_layer_destroy(header->status_text);
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
  layer_set_frame(text_layer_get_layer(header->status_text), GRect(24, 0, frame.size.w - 52, HEADER_HEIGHT));
}

void header_update(Header *header, struct tm *now) {
  if (!header || !now) {
    return;
  }

  static char month_buf[8];
  static char buffer[16];
  strftime(month_buf, sizeof(month_buf), "%b", now);
  snprintf(buffer, sizeof(buffer), "%d %s", now->tm_mday, month_buf);
  text_layer_set_text(header->status_text, buffer);
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
