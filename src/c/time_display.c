#include "time_display.h"

#include "settings.h"

#include <stdio.h>
#include <string.h>

struct TimeDisplay {
  Layer *container;
  TextLayer *time_layer;
  TextLayer *ampm_layer;
};

static bool prv_use_24h(const ArgusSettings *settings) {
  switch (settings->hour_format) {
    case HOUR_FORMAT_24H:
      return true;
    case HOUR_FORMAT_12H:
      return false;
    default:
      return clock_is_24h_style();
  }
}

TimeDisplay *time_display_create(Layer *parent) {
  TimeDisplay *display = malloc(sizeof(TimeDisplay));
  if (!display) {
    return NULL;
  }

  GRect bounds = layer_get_bounds(parent);
  display->container = layer_create(GRect(0, 0, bounds.size.w, TIME_BLOCK_HEIGHT));
  layer_add_child(parent, display->container);

  display->time_layer = text_layer_create(GRect(0, 0, bounds.size.w, TIME_BLOCK_HEIGHT));
  text_layer_set_background_color(display->time_layer, GColorClear);
  text_layer_set_text_color(display->time_layer, GColorWhite);
  text_layer_set_font(display->time_layer, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_text_alignment(display->time_layer, GTextAlignmentCenter);
  layer_add_child(display->container, text_layer_get_layer(display->time_layer));

  display->ampm_layer = text_layer_create(GRect(bounds.size.w - 36, 24, 32, 20));
  text_layer_set_background_color(display->ampm_layer, GColorClear);
  text_layer_set_text_color(display->ampm_layer, GColorWhite);
  text_layer_set_font(display->ampm_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(display->ampm_layer, GTextAlignmentLeft);
  layer_add_child(display->container, text_layer_get_layer(display->ampm_layer));

  return display;
}

void time_display_destroy(TimeDisplay *display) {
  if (!display) {
    return;
  }
  text_layer_destroy(display->ampm_layer);
  text_layer_destroy(display->time_layer);
  layer_destroy(display->container);
  free(display);
}

void time_display_set_bounds(TimeDisplay *display, GRect frame) {
  if (!display) {
    return;
  }
  layer_set_frame(display->container, frame);
  layer_set_frame(text_layer_get_layer(display->time_layer), GRect(0, 0, frame.size.w, frame.size.h));
  layer_set_frame(text_layer_get_layer(display->ampm_layer), GRect(frame.size.w - 36, 24, 32, 20));
}

void time_display_update(TimeDisplay *display, struct tm *now) {
  if (!display || !now) {
    return;
  }

  const ArgusSettings *settings = settings_get();
  bool use_24h = prv_use_24h(settings);

  static char time_buf[8];
  strftime(time_buf, sizeof(time_buf), use_24h ? "%H:%M" : "%I:%M", now);
  text_layer_set_text(display->time_layer, time_buf);

  if (use_24h) {
    text_layer_set_text(display->ampm_layer, "");
  } else {
    static char ampm_buf[4];
    strftime(ampm_buf, sizeof(ampm_buf), "%p", now);
    text_layer_set_text(display->ampm_layer, ampm_buf);
  }
}
