#include "time_display.h"

#include "formatting.h"
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
  int char_widths[256];
  bool char_widths_ready;
  ClockFont cached_clock_font;
  int text_height;
  int max_digit_width;
  int colon_width;
};

static TimeDisplay *s_time_display;

static GFont prv_digit_font(ClockFont clock_font) {
  switch (clock_font) {
    case CLOCK_FONT_ROBOTO:
      return fonts_get_system_font(FONT_KEY_ROBOTO_BOLD_SUBSET_49);
    case CLOCK_FONT_BITHAM_BOLD:
      return fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);
    case CLOCK_FONT_BITHAM_MEDIUM:
      return fonts_get_system_font(FONT_KEY_BITHAM_42_MEDIUM_NUMBERS);
    case CLOCK_FONT_LECO:
    default:
      return fonts_get_system_font(FONT_KEY_LECO_60_BOLD_NUMBERS_AM_PM);
  }
}

static GFont prv_font_for_char(char ch, ClockFont clock_font) {
  if (ch == ':' || (ch >= '0' && ch <= '9')) {
    return prv_digit_font(clock_font);
  }
  return fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);
}

static void prv_cache_char_widths(TimeDisplay *display) {
  ClockFont clock_font = settings_get()->clock_font;
  if (display->char_widths_ready && display->cached_clock_font == clock_font) {
    return;
  }

  for (int i = 0; i < 256; i++) {
    display->char_widths[i] = 0;
  }

  char text[2] = {'\0', '\0'};
  int max_h = 0;
  int max_digit_w = 0;
  for (char ch = '0'; ch <= '9'; ch++) {
    text[0] = ch;
    GSize size = graphics_text_layout_get_content_size(text, prv_font_for_char(ch, clock_font),
                                                       GRect(0, 0, 200, TIME_BLOCK_HEIGHT),
                                                       GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
    display->char_widths[(unsigned char)ch] = size.w;
    if (size.w > max_digit_w) {
      max_digit_w = size.w;
    }
    if (size.h > max_h) {
      max_h = size.h;
    }
  }
  text[0] = ':';
  GSize colon_size = graphics_text_layout_get_content_size(text, prv_font_for_char(':', clock_font),
                                                           GRect(0, 0, 200, TIME_BLOCK_HEIGHT),
                                                           GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
  display->char_widths[(unsigned char)':'] = colon_size.w;
  if (colon_size.h > max_h) {
    max_h = colon_size.h;
  }

  display->max_digit_width = max_digit_w;
  display->colon_width = colon_size.w;
  display->text_height = max_h;
  display->cached_clock_font = clock_font;
  display->char_widths_ready = true;
}

static int prv_char_width(TimeDisplay *display, char ch) {
  int width = display->char_widths[(unsigned char)ch];
  if (width > 0) {
    return width;
  }
  return prv_font_for_char(ch, settings_get()->clock_font) ? 8 : 0;
}

static void prv_draw_char(GContext *ctx, TimeDisplay *display, char ch, int x, int y) {
  char text[2] = {ch, '\0'};
  GFont font = prv_font_for_char(ch, settings_get()->clock_font);
  int width = prv_char_width(display, ch);
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, text, font, GRect(x, y, width + 2, display->text_height),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

static void prv_draw_digit_in_cell(GContext *ctx, TimeDisplay *display, char ch, int cell_x, int cell_w, int y,
                                   bool right_align) {
  int width = prv_char_width(display, ch);
  int x = right_align ? cell_x + cell_w - width : cell_x;
  prv_draw_char(ctx, display, ch, x, y);
}

typedef struct {
  int colon_x;
  int hour_tens_x;
  int hour_ones_x;
  int min_tens_x;
  int min_ones_x;
} TimeLayout;

static TimeLayout prv_time_layout(TimeDisplay *display, GRect bounds, int spacing) {
  int center_x = bounds.origin.x + bounds.size.w / 2;
  int cell_w = display->max_digit_width;
  int colon_w = display->colon_width;
  int colon_x = center_x - colon_w / 2;
  int hour_ones_x = colon_x - spacing - cell_w;
  TimeLayout layout = {
      .colon_x = colon_x,
      .hour_tens_x = hour_ones_x - spacing - cell_w,
      .hour_ones_x = hour_ones_x,
      .min_tens_x = colon_x + colon_w + spacing,
      .min_ones_x = colon_x + colon_w + spacing + cell_w + spacing,
  };
  return layout;
}

static void prv_draw_colon_fixed_time(GContext *ctx, TimeDisplay *display, const char *time_text, TimeLayout layout,
                                      int text_y) {
  const char *colon = strchr(time_text, ':');
  if (!colon) {
    return;
  }

  int cell_w = display->max_digit_width;

  prv_draw_char(ctx, display, ':', layout.colon_x, text_y);

  int hour_len = (int)(colon - time_text);
  if (hour_len == 1) {
    prv_draw_digit_in_cell(ctx, display, time_text[0], layout.hour_ones_x, cell_w, text_y, true);
  } else if (hour_len >= 2) {
    prv_draw_digit_in_cell(ctx, display, time_text[0], layout.hour_tens_x, cell_w, text_y, true);
    prv_draw_digit_in_cell(ctx, display, time_text[1], layout.hour_ones_x, cell_w, text_y, true);
  }

  if (colon[1] != '\0') {
    prv_draw_digit_in_cell(ctx, display, colon[1], layout.min_tens_x, cell_w, text_y, false);
  }
  if (colon[2] != '\0') {
    prv_draw_digit_in_cell(ctx, display, colon[2], layout.min_ones_x, cell_w, text_y, false);
  }
}

static GSize prv_ampm_size(const char *text) {
  GFont font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  return graphics_text_layout_get_content_size(text, font, GRect(0, 0, 40, TIME_BLOCK_HEIGHT),
                                               GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
}

static void prv_draw_ampm(GContext *ctx, const char *text, int x, int text_y, int text_height) {
  GFont font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  GSize size = prv_ampm_size(text);
  int y = text_y + text_height - size.h - 6;
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, text, font, GRect(x, y, size.w + 2, size.h),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

static void prv_time_layer_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  if (!s_time_display) {
    return;
  }

  TimeDisplay *display = s_time_display;
  prv_cache_char_widths(display);

  GRect bounds = layer_get_bounds(layer);
  int spacing = display->show_ampm ? TIME_CHAR_SPACING_12H : TIME_CHAR_SPACING_24H;
  int text_y = bounds.origin.y + (bounds.size.h - display->text_height) / 2;
  TimeLayout layout = prv_time_layout(display, bounds, spacing);

  prv_draw_colon_fixed_time(ctx, display, display->time_text, layout, text_y);

  if (display->show_ampm && display->ampm_text[0] != '\0') {
    prv_draw_ampm(ctx, display->ampm_text, layout.min_ones_x + display->max_digit_width + AM_PM_GAP, text_y,
                  display->text_height);
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
  display->char_widths_ready = false;
  display->cached_clock_font = CLOCK_FONT_LECO;
  s_time_display = display;
  prv_cache_char_widths(display);
  return display;
}

void time_display_apply_settings(TimeDisplay *display) {
  if (!display) {
    return;
  }
  display->char_widths_ready = false;
  layer_mark_dirty(display->time_layer);
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

  struct tm local_now = *now;
  bool use_24h = formatting_use_24h();
  char new_time[sizeof(display->time_text)];
  char new_ampm[sizeof(display->ampm_text)];
  bool new_show_ampm = !use_24h;

  if (use_24h) {
    snprintf(new_time, sizeof(new_time), "%02d:%02d", local_now.tm_hour, local_now.tm_min);
    new_ampm[0] = '\0';
  } else {
    int hour = local_now.tm_hour % 12;
    if (hour == 0) {
      hour = 12;
    }
    snprintf(new_time, sizeof(new_time), "%d:%02d", hour, local_now.tm_min);
    strftime(new_ampm, sizeof(new_ampm), "%p", &local_now);
  }

  if (strcmp(display->time_text, new_time) == 0 && strcmp(display->ampm_text, new_ampm) == 0 &&
      display->show_ampm == new_show_ampm) {
    return;
  }

  strncpy(display->time_text, new_time, sizeof(display->time_text) - 1);
  display->time_text[sizeof(display->time_text) - 1] = '\0';
  strncpy(display->ampm_text, new_ampm, sizeof(display->ampm_text) - 1);
  display->ampm_text[sizeof(display->ampm_text) - 1] = '\0';
  display->show_ampm = new_show_ampm;
  layer_mark_dirty(display->time_layer);
}
