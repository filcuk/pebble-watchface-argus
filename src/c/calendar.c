#include "calendar.h"

#include "settings.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

struct Calendar {
  Layer *layer;
  int year;
  int month;
  int day;
  uint16_t event_mask;
};

static Calendar *s_calendar;

static const char *WEEKDAY_LABELS_MON[] = {"M", "T", "W", "T", "F", "S", "S"};
static const char *WEEKDAY_LABELS_SAT[] = {"S", "S", "M", "T", "W", "T", "F"};

static int prv_weekday_index(int wday, WeekStart week_start) {
  if (week_start == WEEK_START_SATURDAY) {
    return (wday + 1) % 7;
  }
  return (wday + 6) % 7;
}

static void prv_add_days(struct tm *date, int days) {
  date->tm_mday += days;
  mktime(date);
}

static void prv_fill_days(struct tm *days, struct tm *now, WeekStart week_start) {
  struct tm cursor = *now;
  int index = prv_weekday_index(cursor.tm_wday, week_start);
  prv_add_days(&cursor, -index);

  for (int i = 0; i < 14; i++) {
    days[i] = cursor;
    prv_add_days(&cursor, 1);
  }
}

static bool prv_is_today(struct tm *cell, struct tm *now) {
  return cell->tm_year == now->tm_year && cell->tm_mon == now->tm_mon && cell->tm_mday == now->tm_mday;
}

static bool prv_is_weekend(int wday) {
  return wday == 0 || wday == 6;
}

static bool prv_is_weekend_column(int col, WeekStart week_start) {
  if (week_start == WEEK_START_SATURDAY) {
    return col <= 1;
  }
  return col >= 5;
}

static int prv_iso_week_number(struct tm *date) {
  struct tm copy = *date;
  char week_buf[4];
  if (strftime(week_buf, sizeof(week_buf), "%V", &copy) > 0) {
    return atoi(week_buf);
  }
  return 1;
}

static int prv_gregorian_week_number(struct tm *date) {
  struct tm copy = *date;
  copy.tm_hour = 12;
  copy.tm_min = 0;
  copy.tm_sec = 0;
  mktime(&copy);

  struct tm year_start = copy;
  year_start.tm_mon = 0;
  year_start.tm_mday = 1;
  mktime(&year_start);

  int jan1_wday = year_start.tm_wday;
  int offset = (copy.tm_yday + 7 - jan1_wday) / 7;
  return offset + 1;
}

static int prv_week_number_for_date(struct tm *date, WeekNumberMode mode) {
  return mode == WEEK_NUMBER_ISO ? prv_iso_week_number(date) : prv_gregorian_week_number(date);
}

static const int DAY_TEXT_HEIGHT = 14;
static const int TODAY_BOX_EXTRA_BOTTOM = 2;

static GRect prv_day_text_rect(GRect cell) {
  return GRect(cell.origin.x, cell.origin.y + (cell.size.h - DAY_TEXT_HEIGHT) / 2, cell.size.w, DAY_TEXT_HEIGHT);
}

static GRect prv_today_highlight_rect(GRect cell, int text_w) {
  int w = text_w * 3;
  if (w > cell.size.w) {
    w = cell.size.w;
  }
  int h = DAY_TEXT_HEIGHT + TODAY_BOX_EXTRA_BOTTOM;
  if (h > cell.size.h) {
    h = cell.size.h;
  }
  int cx = cell.origin.x + cell.size.w / 2;
  int y = cell.origin.y + (cell.size.h - DAY_TEXT_HEIGHT) / 2;
  return GRect(cx - w / 2, y, w, h);
}

static void prv_calendar_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Calendar *calendar = s_calendar;
  if (!calendar) {
    return;
  }
  GRect bounds = layer_get_bounds(layer);
  const ArgusSettings *settings = settings_get();
  const char **labels = settings->week_start == WEEK_START_SATURDAY ? WEEKDAY_LABELS_SAT : WEEKDAY_LABELS_MON;

  struct tm now = {0};
  now.tm_year = calendar->year;
  now.tm_mon = calendar->month;
  now.tm_mday = calendar->day;
  mktime(&now);

  struct tm cells[14];
  prv_fill_days(cells, &now, settings->week_start);

  int grid_left = CALENDAR_WEEK_LABEL_WIDTH;
  int grid_w = bounds.size.w - grid_left;
  int col_w = grid_w / 7;
  int row_y[2] = {CALENDAR_HEADER_HEIGHT + CALENDAR_ROW_GAP,
                  CALENDAR_HEADER_HEIGHT + CALENDAR_ROW_GAP + CALENDAR_ROW_HEIGHT + CALENDAR_ROW_GAP};

  graphics_context_set_text_color(ctx, GColorWhite);
  for (int col = 0; col < 7; col++) {
    graphics_context_set_text_color(ctx, prv_is_weekend_column(col, settings->week_start) ? GColorRed : GColorWhite);
    graphics_draw_text(ctx, labels[col], fonts_get_system_font(FONT_KEY_GOTHIC_14),
                       GRect(grid_left + col * col_w, 0, col_w, CALENDAR_HEADER_HEIGHT),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
  }

  static char week_buf[4];
  for (int row = 0; row < 2; row++) {
    int week = prv_week_number_for_date(&cells[row * 7], settings->week_number_mode);
    snprintf(week_buf, sizeof(week_buf), "%d", week);
    graphics_context_set_text_color(ctx, GColorWhite);
    graphics_draw_text(ctx, week_buf, fonts_get_system_font(FONT_KEY_GOTHIC_14),
                       GRect(0, row_y[row], CALENDAR_WEEK_LABEL_WIDTH - 1, CALENDAR_ROW_HEIGHT),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
  }

  for (int i = 0; i < 14; i++) {
    int row = i / 7;
    int col = i % 7;
    GRect cell = GRect(grid_left + col * col_w + 1, row_y[row], col_w - 2, CALENDAR_ROW_HEIGHT);
    bool today = prv_is_today(&cells[i], &now);
    bool has_event = settings->show_event_indicators && (calendar->event_mask & (1 << i));

    static char day_buf[4];
    snprintf(day_buf, sizeof(day_buf), "%d", cells[i].tm_mday);

    GFont day_font = today ? fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD)
                           : fonts_get_system_font(FONT_KEY_GOTHIC_14);
    GRect text_rect = prv_day_text_rect(cell);

    if (today) {
      GSize text_size =
          graphics_text_layout_get_content_size(day_buf, day_font, text_rect, GTextOverflowModeTrailingEllipsis,
                                                GTextAlignmentCenter);
      text_rect = prv_today_highlight_rect(cell, text_size.w);
      graphics_context_set_fill_color(ctx, GColorWhite);
      graphics_fill_rect(ctx, text_rect, 2, GCornersAll);
      graphics_context_set_text_color(ctx, GColorBlack);
    } else {
      graphics_context_set_text_color(ctx, prv_is_weekend(cells[i].tm_wday) ? GColorRed : GColorWhite);
    }

    graphics_draw_text(ctx, day_buf, day_font, text_rect, GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter,
                       NULL);

    if (has_event) {
      graphics_context_set_fill_color(ctx, today ? GColorBlack : GColorVividCerulean);
      graphics_fill_circle(ctx, GPoint(cell.origin.x + cell.size.w / 2, cell.origin.y + cell.size.h - 4), 2);
    }
  }
}

Calendar *calendar_create(Layer *parent) {
  Calendar *calendar = malloc(sizeof(Calendar));
  if (!calendar) {
    return NULL;
  }

  GRect bounds = layer_get_bounds(parent);
  calendar->layer = layer_create(GRect(0, 0, bounds.size.w, CALENDAR_HEIGHT));
  layer_set_update_proc(calendar->layer, prv_calendar_update_proc);
  layer_add_child(parent, calendar->layer);

  time_t now = time(NULL);
  struct tm *tm_now = localtime(&now);
  calendar->year = tm_now->tm_year;
  calendar->month = tm_now->tm_mon;
  calendar->day = tm_now->tm_mday;
  calendar->event_mask = 0;
  s_calendar = calendar;
  return calendar;
}

void calendar_destroy(Calendar *calendar) {
  if (!calendar) {
    return;
  }
  if (s_calendar == calendar) {
    s_calendar = NULL;
  }
  layer_destroy(calendar->layer);
  free(calendar);
}

void calendar_set_bounds(Calendar *calendar, GRect frame) {
  if (!calendar) {
    return;
  }
  layer_set_frame(calendar->layer, frame);
}

void calendar_update(Calendar *calendar, struct tm *now) {
  if (!calendar || !now) {
    return;
  }
  calendar->year = now->tm_year;
  calendar->month = now->tm_mon;
  calendar->day = now->tm_mday;
  layer_mark_dirty(calendar->layer);
}

void calendar_set_event_days(Calendar *calendar, uint16_t event_mask) {
  if (!calendar) {
    return;
  }
  calendar->event_mask = event_mask;
  layer_mark_dirty(calendar->layer);
}
