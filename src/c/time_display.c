#include "time_display.h"

#include "settings.h"

#include <stdio.h>
#include <string.h>

#define TIME_CHAR_SPACING 6

struct TimeDisplay {
  Layer *container;
  Layer *time_layer;
  TextLayer *ampm_layer;
  char time_text[8];
};

static TimeDisplay *s_time_display;

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

static GFont prv_font_for_char(char ch) {
  if (ch == ':' || (ch >= '0' && ch <= '9')) {
    return fonts_get_system_font(FONT_KEY_LECO_60_BOLD_NUMBERS_AM_PM);
  }
  return fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);
}

static GSize prv_char_size(char ch, GFont font) {
  char text[2] = {ch, '\0'};
  return graphics_text_layout_get_content_size(text, font, GRect(0, 0, 200, TIME_BLOCK_HEIGHT),
                                               GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
}

static void prv_draw_spaced_time(GContext *ctx, const char *text, GRect bounds) {
  int len = strlen(text);
  if (len == 0) {
    return;
  }

  int total_w = 0;
  for (int i = 0; i < len; i++) {
    total_w += prv_char_size(text[i], prv_font_for_char(text[i])).w;
    if (i < len - 1) {
      total_w += TIME_CHAR_SPACING;
    }
  }

  int x = bounds.origin.x + (bounds.size.w - total_w) / 2;
  char ch[2] = {'\0', '\0'};

  for (int i = 0; i < len; i++) {
    ch[0] = text[i];
    GFont font = prv_font_for_char(ch[0]);
    GSize size = prv_char_size(ch[0], font);
    graphics_context_set_text_color(ctx, GColorWhite);
    graphics_draw_text(ctx, ch, font, GRect(x, bounds.origin.y, size.w + 2, bounds.size.h),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
    x += size.w + TIME_CHAR_SPACING;
  }
}

static void prv_time_layer_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  if (!s_time_display) {
    return;
  }
  prv_draw_spaced_time(ctx, s_time_display->time_text, layer_get_bounds(layer));
}

TimeDisplay *time_display_create(Layer *parent) {
  TimeDisplay *display = malloc(sizeof(TimeDisplay));
  if (!display) {
    return NULL;
  }

  GRect bounds = layer_get_bounds(parent);
  display->container = layer_create(GRect(0, 0, bounds.size.w, TIME_BLOCK_HEIGHT));
  layer_add_child(parent, display->container);

  display->time_layer = layer_create(GRect(0, 0, bounds.size.w, TIME_BLOCK_HEIGHT));
  layer_set_update_proc(display->time_layer, prv_time_layer_update_proc);
  layer_add_child(display->container, display->time_layer);

  display->ampm_layer = text_layer_create(GRect(bounds.size.w - 36, bounds.size.h - 24, 32, 20));
  text_layer_set_background_color(display->ampm_layer, GColorClear);
  text_layer_set_text_color(display->ampm_layer, GColorWhite);
  text_layer_set_font(display->ampm_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(display->ampm_layer, GTextAlignmentLeft);
  layer_add_child(display->container, text_layer_get_layer(display->ampm_layer));

  display->time_text[0] = '\0';
  s_time_display = display;
  return display;
}

void time_display_destroy(TimeDisplay *display) {
  if (!display) {
    return;
  }
  if (s_time_display == display) {
    s_time_display = NULL;
  }
  text_layer_destroy(display->ampm_layer);
  layer_destroy(display->time_layer);
  layer_destroy(display->container);
  free(display);
}

void time_display_set_bounds(TimeDisplay *display, GRect frame) {
  if (!display) {
    return;
  }
  layer_set_frame(display->container, frame);
  layer_set_frame(display->time_layer, GRect(0, 0, frame.size.w, frame.size.h));
  layer_set_frame(text_layer_get_layer(display->ampm_layer), GRect(frame.size.w - 36, frame.size.h - 24, 32, 20));
}

void time_display_update(TimeDisplay *display, struct tm *now) {
  if (!display || !now) {
    return;
  }

  const ArgusSettings *settings = settings_get();
  bool use_24h = prv_use_24h(settings);

  if (use_24h) {
    snprintf(display->time_text, sizeof(display->time_text), "%02d:%02d", now->tm_hour, now->tm_min);
  } else {
    int hour = now->tm_hour % 12;
    if (hour == 0) {
      hour = 12;
    }
    snprintf(display->time_text, sizeof(display->time_text), "%d:%02d", hour, now->tm_min);
  }

  layer_mark_dirty(display->time_layer);

  if (use_24h) {
    text_layer_set_text(display->ampm_layer, "");
  } else {
    static char ampm_buf[4];
    strftime(ampm_buf, sizeof(ampm_buf), "%p", now);
    text_layer_set_text(display->ampm_layer, ampm_buf);
  }
}
