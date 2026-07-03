#include "time_display.h"

#include "settings.h"

#include <stdio.h>
#include <string.h>

#define TIME_CHAR_SPACING_24H 6
#define TIME_CHAR_SPACING_12H 4
#define AM_PM_GAP 4

struct TimeDisplay {
  Layer *container;
  Layer *time_layer;
  char time_text[8];
  char ampm_text[4];
  bool show_ampm;
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

static int prv_measure_spaced_time(const char *text, int spacing) {
  int len = strlen(text);
  if (len == 0) {
    return 0;
  }

  int total_w = 0;
  for (int i = 0; i < len; i++) {
    total_w += prv_char_size(text[i], prv_font_for_char(text[i])).w;
    if (i < len - 1) {
      total_w += spacing;
    }
  }
  return total_w;
}

static void prv_draw_spaced_time(GContext *ctx, const char *text, GRect bounds, int spacing, int x) {
  int len = strlen(text);
  if (len == 0) {
    return;
  }

  char ch[2] = {'\0', '\0'};
  for (int i = 0; i < len; i++) {
    ch[0] = text[i];
    GFont font = prv_font_for_char(ch[0]);
    GSize size = prv_char_size(ch[0], font);
    graphics_context_set_text_color(ctx, GColorWhite);
    graphics_draw_text(ctx, ch, font, GRect(x, bounds.origin.y, size.w + 2, bounds.size.h),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
    x += size.w + spacing;
  }
}

static GSize prv_ampm_size(const char *text) {
  GFont font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  return graphics_text_layout_get_content_size(text, font, GRect(0, 0, 40, TIME_BLOCK_HEIGHT),
                                               GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
}

static void prv_draw_ampm(GContext *ctx, const char *text, GRect bounds, int x) {
  GFont font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  GSize size = prv_ampm_size(text);
  int y = bounds.origin.y + bounds.size.h - size.h - 6;
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, text, font, GRect(x, y, size.w + 2, size.h),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

static void prv_time_layer_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  if (!s_time_display) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  int spacing = s_time_display->show_ampm ? TIME_CHAR_SPACING_12H : TIME_CHAR_SPACING_24H;
  int time_w = prv_measure_spaced_time(s_time_display->time_text, spacing);
  int start_x = bounds.origin.x;

  if (s_time_display->show_ampm && s_time_display->ampm_text[0] != '\0') {
    GSize ampm_size = prv_ampm_size(s_time_display->ampm_text);
    int total_w = time_w + AM_PM_GAP + ampm_size.w;
    start_x = bounds.origin.x + (bounds.size.w - total_w) / 2;
    prv_draw_spaced_time(ctx, s_time_display->time_text, bounds, spacing, start_x);
    prv_draw_ampm(ctx, s_time_display->ampm_text, bounds, start_x + time_w + AM_PM_GAP);
  } else {
    start_x = bounds.origin.x + (bounds.size.w - time_w) / 2;
    prv_draw_spaced_time(ctx, s_time_display->time_text, bounds, spacing, start_x);
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

  display->time_layer = layer_create(GRect(0, 0, bounds.size.w, TIME_BLOCK_HEIGHT));
  layer_set_update_proc(display->time_layer, prv_time_layer_update_proc);
  layer_add_child(display->container, display->time_layer);

  display->time_text[0] = '\0';
  display->ampm_text[0] = '\0';
  display->show_ampm = false;
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

  display->show_ampm = !use_24h;
  if (use_24h) {
    display->ampm_text[0] = '\0';
  } else {
    strftime(display->ampm_text, sizeof(display->ampm_text), "%p", now);
  }

  layer_mark_dirty(display->time_layer);
}
