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
  struct tm cells[14];
  bool cells_valid;
  bool force_dirty;
  int last_year;
  int last_mon;
  int last_mday;
};

static Calendar *s_calendar;

static const char *WEEKDAY_LABELS_MON[] = {"M", "T", "W", "T", "F", "S", "S"};
static const char *WEEKDAY_LABELS_SUN[] = {"S", "M", "T", "W", "T", "F", "S"};

static int prv_days_since_week_start(int wday, WeekStart week_start) {
  int start_wday = (week_start == WEEK_START_SUNDAY) ? 0 : 1;
  return (wday - start_wday + 7) % 7;
}

static void prv_fill_days(struct tm *days, struct tm *now, WeekStart week_start) {
  struct tm cursor = *now;
  mktime(&cursor);

  int index = prv_days_since_week_start(cursor.tm_wday, week_start);
  time_t time = mktime(&cursor);
  time -= (time_t)index * SECONDS_PER_DAY;

  for (int i = 0; i < 14; i++) {
    struct tm *day_tm = localtime(&time);
    if (day_tm) {
      days[i] = *day_tm;
    }
    time += SECONDS_PER_DAY;
  }
}

static void prv_refresh_cells(Calendar *calendar) {
  struct tm now = {0};
  now.tm_year = calendar->year;
  now.tm_mon = calendar->month;
  now.tm_mday = calendar->day;
  mktime(&now);

  prv_fill_days(calendar->cells, &now, settings_get()->week_start);
  calendar->cells_valid = true;
}

static bool prv_is_today(struct tm *cell, struct tm *now) {
  return cell->tm_year == now->tm_year && cell->tm_mon == now->tm_mon && cell->tm_mday == now->tm_mday;
}

static bool prv_is_weekend(int wday) {
  return wday == 0 || wday == 6;
}

static bool prv_is_weekend_column(int col, WeekStart week_start) {
  if (week_start == WEEK_START_SUNDAY) {
    return col == 0 || col == 6;
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

static const int DAY_LINE_HEIGHT = 14;
static const int TODAY_PILL_CORNER_RADIUS = 2;
static const int TODAY_PILL_INK_HEIGHT = 8;
static const int TODAY_PILL_PAD_V = 4;
static const int TODAY_PILL_Y_OFFSET = -1;
#define CALENDAR_WEEKEND_COLOR GColorMelon

static GRect prv_row_text_rect(GRect cell) {
  return GRect(cell.origin.x, cell.origin.y + (cell.size.h - DAY_LINE_HEIGHT) / 2, cell.size.w, DAY_LINE_HEIGHT);
}

static GSize prv_text_content_size(const char *text, GFont font, GRect bounds, GTextAlignment alignment) {
  return graphics_text_layout_get_content_size(text, font, bounds, GTextOverflowModeTrailingEllipsis, alignment);
}

static GRect prv_today_pill_rect(GRect text_rect, GRect cell, int text_w) {
  int w = text_w * 3;
  if (w > cell.size.w) {
    w = cell.size.w;
  }
  int cx = cell.origin.x + cell.size.w / 2;
  int bottom = text_rect.origin.y + text_rect.size.h;
  int ink_y = bottom - TODAY_PILL_INK_HEIGHT;

  int space_above = ink_y - cell.origin.y;
  int space_below = (cell.origin.y + cell.size.h) - bottom;
  int pad = TODAY_PILL_PAD_V;
  if (pad > space_above) {
    pad = space_above;
  }
  if (pad > space_below) {
    pad = space_below;
  }
  if (pad < 0) {
    pad = 0;
  }

  int h = TODAY_PILL_INK_HEIGHT + pad * 2;
  int ink_cy = ink_y + TODAY_PILL_INK_HEIGHT / 2;
  int y = ink_cy - h / 2 + TODAY_PILL_Y_OFFSET;
  return GRect(cx - w / 2, y, w, h);
}

static void prv_draw_text(GContext *ctx, const char *text, GFont font, GRect text_rect, GTextAlignment alignment,
                          GColor color) {
  graphics_context_set_text_color(ctx, color);
  graphics_draw_text(ctx, text, font, text_rect, GTextOverflowModeTrailingEllipsis, alignment, NULL);
}

static void prv_calendar_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Calendar *calendar = s_calendar;
  if (!calendar || !calendar->cells_valid) {
    return;
  }
  GRect bounds = layer_get_bounds(layer);
  const ArgusSettings *settings = settings_get();
  const char **labels = settings->week_start == WEEK_START_SUNDAY ? WEEKDAY_LABELS_SUN : WEEKDAY_LABELS_MON;

  struct tm now = {0};
  now.tm_year = calendar->year;
  now.tm_mon = calendar->month;
  now.tm_mday = calendar->day;
  mktime(&now);

  int grid_left = CALENDAR_WEEK_LABEL_WIDTH;
  int grid_w = bounds.size.w - grid_left;
  int col_w = grid_w / 7;
  int row_y[2] = {CALENDAR_HEADER_HEIGHT + CALENDAR_HEADER_ROW_GAP,
                  CALENDAR_HEADER_HEIGHT + CALENDAR_HEADER_ROW_GAP + CALENDAR_ROW_HEIGHT + CALENDAR_WEEK_ROW_GAP};

  GFont day_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  GFont today_font = fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
  bool show_month_label = settings_show_calendar_month();

  if (show_month_label) {
    static char month_buf[8];
    strftime(month_buf, sizeof(month_buf), "%b", &now);
    GRect month_cell = GRect(0, 0, CALENDAR_WEEK_LABEL_WIDTH - 1, CALENDAR_HEADER_HEIGHT);
    GRect month_text_rect = prv_row_text_rect(month_cell);
    prv_draw_text(ctx, month_buf, day_font, month_text_rect, GTextAlignmentRight, GColorWhite);
  }

  for (int col = 0; col < 7; col++) {
    GRect header_cell = GRect(grid_left + col * col_w, 0, col_w, CALENDAR_HEADER_HEIGHT);
    GRect text_rect = prv_row_text_rect(header_cell);
    prv_draw_text(ctx, labels[col], day_font, text_rect, GTextAlignmentCenter,
                  prv_is_weekend_column(col, settings->week_start) ? CALENDAR_WEEKEND_COLOR : GColorWhite);
  }

  static char week_buf[6];
  for (int row = 0; row < 2; row++) {
    int week = prv_week_number_for_date(&calendar->cells[row * 7], settings->week_number_mode);
    snprintf(week_buf, sizeof(week_buf), "W%d", week);
    GRect week_cell = GRect(0, row_y[row], CALENDAR_WEEK_LABEL_WIDTH - 1, CALENDAR_ROW_HEIGHT);
    GRect text_rect = prv_row_text_rect(week_cell);
    prv_draw_text(ctx, week_buf, day_font, text_rect, GTextAlignmentRight, GColorWhite);
  }

  for (int i = 0; i < 14; i++) {
    int row = i / 7;
    int col = i % 7;
    GRect cell = GRect(grid_left + col * col_w + 1, row_y[row], col_w - 2, CALENDAR_ROW_HEIGHT);
    bool today = prv_is_today(&calendar->cells[i], &now);
    bool has_event = settings->show_event_indicators && (calendar->event_mask & (1 << i));

    static char day_buf[4];
    snprintf(day_buf, sizeof(day_buf), "%d", calendar->cells[i].tm_mday);

    GRect text_rect = prv_row_text_rect(cell);
    GFont draw_font = today ? today_font : day_font;

    if (today) {
      GSize text_size =
          prv_text_content_size(day_buf, draw_font, text_rect, GTextAlignmentCenter);
      GRect pill = prv_today_pill_rect(text_rect, cell, text_size.w);
      graphics_context_set_fill_color(ctx, GColorWhite);
      graphics_fill_rect(ctx, pill, TODAY_PILL_CORNER_RADIUS, GCornersAll);
      prv_draw_text(ctx, day_buf, draw_font, text_rect, GTextAlignmentCenter, GColorBlack);
    } else {
      prv_draw_text(ctx, day_buf, draw_font, text_rect, GTextAlignmentCenter,
                    prv_is_weekend(calendar->cells[i].tm_wday) ? CALENDAR_WEEKEND_COLOR : GColorWhite);
    }

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
  if (tm_now) {
    calendar->year = tm_now->tm_year;
    calendar->month = tm_now->tm_mon;
    calendar->day = tm_now->tm_mday;
  } else {
    calendar->year = 0;
    calendar->month = 0;
    calendar->day = 1;
  }
  calendar->event_mask = 0;
  calendar->cells_valid = false;
  calendar->force_dirty = true;
  calendar->last_year = -1;
  calendar->last_mon = -1;
  calendar->last_mday = -1;
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

void calendar_invalidate(Calendar *calendar) {
  if (!calendar) {
    return;
  }
  calendar->force_dirty = true;
}

void calendar_update(Calendar *calendar, struct tm *now) {
  if (!calendar || !now) {
    return;
  }

  bool force = calendar->force_dirty;
  bool date_changed =
      calendar->last_year != now->tm_year || calendar->last_mon != now->tm_mon || calendar->last_mday != now->tm_mday;

  if (!force && !date_changed) {
    return;
  }

  calendar->force_dirty = false;
  calendar->year = now->tm_year;
  calendar->month = now->tm_mon;
  calendar->day = now->tm_mday;
  calendar->last_year = now->tm_year;
  calendar->last_mon = now->tm_mon;
  calendar->last_mday = now->tm_mday;
  prv_refresh_cells(calendar);
  layer_mark_dirty(calendar->layer);
}

void calendar_set_event_days(Calendar *calendar, uint16_t event_mask) {
  if (!calendar) {
    return;
  }
  if (calendar->event_mask == event_mask) {
    return;
  }
  calendar->event_mask = event_mask;
  layer_mark_dirty(calendar->layer);
}

