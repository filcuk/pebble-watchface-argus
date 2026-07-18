#include "calendar.h"

#include "argus_time.h"
#include "settings.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

typedef struct {
  int grid_left;
  int col_w;
  int col_rem; /* first col_rem columns are 1px wider so the grid fills to SIDE_PAD_RIGHT */
  int row_y[2];
} CalendarGridLayout;

struct Calendar {
  Layer *layer;
  Layer *holiday_layer;
  Layer *today_layer;
  int year;
  int month;
  int day;
  uint16_t event_mask;
  struct tm cells[14];
  char day_labels[14][4];
  char week_labels[2][6];
  char month_label[8];
  CalendarGridLayout grid_layout;
  bool layout_valid;
  int layout_bounds_w;
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

/* Civil-date helpers - avoid mktime()/localtime() round-trips. On Pebble, mktime
 * treats broken-down time as UTC, so reconstructing local midnight then converting
 * back shifts the calendar date backward in UTC-negative zones (e.g. US). */
static bool prv_is_leap_year(int tm_year) {
  int year = tm_year + 1900;
  return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
}

static int prv_days_in_month(int tm_year, int tm_mon) {
  static const int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  if (tm_mon == 1 && prv_is_leap_year(tm_year)) {
    return 29;
  }
  return days[tm_mon];
}

static int prv_day_of_year(int tm_year, int tm_mon, int tm_mday) {
  static const int cum_days[] = {0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334};
  int yday = cum_days[tm_mon] + tm_mday - 1;
  if (tm_mon > 1 && prv_is_leap_year(tm_year)) {
    yday++;
  }
  return yday;
}

static void prv_add_days(struct tm *date, int days) {
  date->tm_wday = ((date->tm_wday + days) % 7 + 7) % 7;

  int year = date->tm_year;
  int mon = date->tm_mon;
  int mday = date->tm_mday + days;

  while (mday < 1) {
    mon--;
    if (mon < 0) {
      mon = 11;
      year--;
    }
    mday += prv_days_in_month(year, mon);
  }
  while (mday > prv_days_in_month(year, mon)) {
    mday -= prv_days_in_month(year, mon);
    mon++;
    if (mon > 11) {
      mon = 0;
      year++;
    }
  }

  date->tm_year = year;
  date->tm_mon = mon;
  date->tm_mday = mday;
  date->tm_yday = prv_day_of_year(year, mon, mday);
}

static void prv_fill_days(struct tm *days, struct tm *now, WeekStart week_start) {
  struct tm cursor = *now;
  int index = prv_days_since_week_start(cursor.tm_wday, week_start);
  prv_add_days(&cursor, -index);

  for (int i = 0; i < 14; i++) {
    days[i] = cursor;
    prv_add_days(&cursor, 1);
  }
}

static void prv_refresh_cells(Calendar *calendar, struct tm *now) {
  prv_fill_days(calendar->cells, now, settings_get()->week_start);
  calendar->cells_valid = true;
}

static bool prv_is_today(struct tm *cell, Calendar *calendar) {
  return cell->tm_year == calendar->year && cell->tm_mon == calendar->month &&
         cell->tm_mday == calendar->day;
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
  /* ISO week: week containing Thursday; week 1 has the year's first Thursday. */
  struct tm thursday = *date;
  int monday_based = (date->tm_wday + 6) % 7;
  prv_add_days(&thursday, 3 - monday_based);
  return prv_day_of_year(thursday.tm_year, thursday.tm_mon, thursday.tm_mday) / 7 + 1;
}

static int prv_gregorian_week_number(struct tm *date) {
  int yday = prv_day_of_year(date->tm_year, date->tm_mon, date->tm_mday);
  int jan1_wday = (date->tm_wday - (yday % 7) + 7) % 7;
  return (yday + 7 - jan1_wday) / 7 + 1;
}

static int prv_week_number_for_date(struct tm *date, WeekNumberMode mode) {
  return mode == WEEK_NUMBER_ISO ? prv_iso_week_number(date) : prv_gregorian_week_number(date);
}

static void prv_refresh_labels(Calendar *calendar) {
  struct tm month_tm = {0};
  month_tm.tm_year = calendar->year;
  month_tm.tm_mon = calendar->month;
  month_tm.tm_mday = 1;
  strftime(calendar->month_label, sizeof(calendar->month_label), "%b", &month_tm);

  const ArgusSettings *settings = settings_get();
  for (int row = 0; row < 2; row++) {
    int week = prv_week_number_for_date(&calendar->cells[row * 7], settings->week_number_mode);
    if (week < 1) {
      week = 1;
    } else if (week > 53) {
      week = 53;
    }
    snprintf(calendar->week_labels[row], sizeof(calendar->week_labels[row]), "W%d", week);
  }
  for (int i = 0; i < 14; i++) {
    snprintf(calendar->day_labels[i], sizeof(calendar->day_labels[i]), "%d", calendar->cells[i].tm_mday);
  }
}

static GRect prv_row_text_rect(GRect cell, int line_height) {
  return GRect(cell.origin.x, cell.origin.y + (cell.size.h - line_height) / 2, cell.size.w, line_height);
}

static void prv_compute_grid_layout(GRect bounds, CalendarGridLayout *layout) {
  layout->grid_left = CALENDAR_SIDE_PAD_LEFT + CALENDAR_WEEK_LABEL_WIDTH + CALENDAR_WEEK_COLUMN_GAP;
  int grid_w = bounds.size.w - layout->grid_left - CALENDAR_SIDE_PAD_RIGHT;
  layout->col_w = grid_w / 7;
  layout->col_rem = grid_w % 7;
  layout->row_y[0] = CALENDAR_HEADER_HEIGHT + CALENDAR_HEADER_ROW_GAP;
  layout->row_y[1] = CALENDAR_HEADER_HEIGHT + CALENDAR_HEADER_ROW_GAP + CALENDAR_ROW_HEIGHT + CALENDAR_WEEK_ROW_GAP;
}

static const CalendarGridLayout *prv_ensure_grid_layout(Calendar *calendar, GRect bounds) {
  if (!calendar->layout_valid || calendar->layout_bounds_w != bounds.size.w) {
    prv_compute_grid_layout(bounds, &calendar->grid_layout);
    calendar->layout_bounds_w = bounds.size.w;
    calendar->layout_valid = true;
  }
  return &calendar->grid_layout;
}

static int prv_col_width(const CalendarGridLayout *layout, int col) {
  return layout->col_w + (col < layout->col_rem ? 1 : 0);
}

static int prv_col_x(const CalendarGridLayout *layout, int col) {
  if (col < layout->col_rem) {
    return layout->grid_left + col * (layout->col_w + 1);
  }
  return layout->grid_left + layout->col_rem * (layout->col_w + 1) + (col - layout->col_rem) * layout->col_w;
}

static GRect prv_day_cell_rect(int index, const CalendarGridLayout *layout) {
  int row = index / 7;
  int col = index % 7;
  int col_w = prv_col_width(layout, col);
  return GRect(prv_col_x(layout, col) + CALENDAR_CELL_PAD_H, layout->row_y[row],
               col_w - CALENDAR_CELL_PAD_H * 2, CALENDAR_ROW_HEIGHT);
}

static void prv_mark_calendar_dirty(Calendar *calendar) {
  layer_mark_dirty(calendar->layer);
  layer_mark_dirty(calendar->holiday_layer);
  layer_mark_dirty(calendar->today_layer);
}

static GSize prv_text_content_size(const char *text, GFont font, GRect bounds, GTextAlignment alignment) {
  return graphics_text_layout_get_content_size(text, font, bounds, GTextOverflowModeTrailingEllipsis, alignment);
}

static GRect prv_today_pill_rect(GRect text_rect, int text_w, int cell_w) {
  int w = (text_w * CALENDAR_TODAY_PILL_WIDTH_NUM) / CALENDAR_TODAY_PILL_WIDTH_DEN;
  if (w > cell_w) {
    w = cell_w;
  }
  int cx = text_rect.origin.x + text_rect.size.w / 2;
  int bottom = text_rect.origin.y + text_rect.size.h;
  int ink_y = bottom - CALENDAR_TODAY_PILL_INK_HEIGHT;
  int pad = CALENDAR_TODAY_PILL_PAD_V;
  int h = CALENDAR_TODAY_PILL_INK_HEIGHT + pad * 2;
  int ink_cy = ink_y + CALENDAR_TODAY_PILL_INK_HEIGHT / 2;
  int y = ink_cy - h / 2 + CALENDAR_TODAY_PILL_Y_OFFSET;
  return GRect(cx - w / 2, y, w, h);
}

/* Fixed two-digit width so holiday/today pills match for days 1–9 and 10–31. */
static GRect prv_day_pill_rect(GRect text_rect, GFont font, int cell_w) {
  GSize ref = prv_text_content_size("00", font, text_rect, GTextAlignmentCenter);
  return prv_today_pill_rect(text_rect, ref.w, cell_w);
}

static void prv_draw_holiday_frame(GContext *ctx, GRect pill) {
  graphics_context_set_stroke_color(ctx, CALENDAR_HOLIDAY_FRAME_COLOR);
  graphics_context_set_stroke_width(ctx, CALENDAR_HOLIDAY_FRAME_WIDTH);
  graphics_draw_round_rect(ctx, pill, CALENDAR_TODAY_PILL_CORNER_RADIUS);
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
  const CalendarGridLayout *layout = prv_ensure_grid_layout(calendar, bounds);

  GFont header_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  GFont day_font = fonts_get_system_font(FONT_KEY_GOTHIC_18);
  bool show_month_label = settings_show_calendar_month();

  if (show_month_label) {
    GFont month_font = fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
    GRect month_cell =
        GRect(CALENDAR_SIDE_PAD_LEFT, 0, CALENDAR_WEEK_LABEL_WIDTH - CALENDAR_SIDE_LABEL_INSET, CALENDAR_HEADER_HEIGHT);
    GRect month_text_rect = prv_row_text_rect(month_cell, CALENDAR_HEADER_LINE_HEIGHT);
    prv_draw_text(ctx, calendar->month_label, month_font, month_text_rect, GTextAlignmentRight, GColorWhite);
  }

  for (int col = 0; col < 7; col++) {
    int col_w = prv_col_width(layout, col);
    GRect header_cell = GRect(prv_col_x(layout, col), 0, col_w, CALENDAR_HEADER_HEIGHT);
    GRect text_rect = prv_row_text_rect(header_cell, CALENDAR_HEADER_LINE_HEIGHT);
    prv_draw_text(ctx, labels[col], header_font, text_rect, GTextAlignmentCenter,
                  prv_is_weekend_column(col, settings->week_start) ? CALENDAR_WEEKEND_COLOR : GColorWhite);
  }

  for (int row = 0; row < 2; row++) {
    GRect week_cell = GRect(CALENDAR_SIDE_PAD_LEFT, layout->row_y[row],
                            CALENDAR_WEEK_LABEL_WIDTH - CALENDAR_SIDE_LABEL_INSET, CALENDAR_ROW_HEIGHT);
    GRect text_rect = prv_row_text_rect(week_cell, CALENDAR_DAY_LINE_HEIGHT);
    prv_draw_text(ctx, calendar->week_labels[row], day_font, text_rect, GTextAlignmentRight, CALENDAR_WEEK_NUMBER_COLOR);
  }

  for (int i = 0; i < 14; i++) {
    if (prv_is_today(&calendar->cells[i], calendar)) {
      continue;
    }

    GRect cell = prv_day_cell_rect(i, layout);
    GRect text_rect = prv_row_text_rect(cell, CALENDAR_DAY_LINE_HEIGHT);
    prv_draw_text(ctx, calendar->day_labels[i], day_font, text_rect, GTextAlignmentCenter,
                  prv_is_weekend(calendar->cells[i].tm_wday) ? CALENDAR_WEEKEND_COLOR : GColorWhite);
  }
}

static void prv_holiday_layer_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Calendar *calendar = s_calendar;
  if (!calendar || !calendar->cells_valid) {
    return;
  }

  const ArgusSettings *settings = settings_get();
  if (!settings->show_event_indicators || !calendar->event_mask) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  const CalendarGridLayout *layout = prv_ensure_grid_layout(calendar, bounds);
  GFont day_font = fonts_get_system_font(FONT_KEY_GOTHIC_18);

  for (int i = 0; i < 14; i++) {
    if (!(calendar->event_mask & (1 << i))) {
      continue;
    }
    if (prv_is_today(&calendar->cells[i], calendar)) {
      continue;
    }

    GRect cell = prv_day_cell_rect(i, layout);
    GRect text_rect = prv_row_text_rect(cell, CALENDAR_DAY_LINE_HEIGHT);
    GRect pill = prv_day_pill_rect(text_rect, day_font, cell.size.w);
    prv_draw_holiday_frame(ctx, pill);
  }
}

static void prv_today_layer_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  Calendar *calendar = s_calendar;
  if (!calendar || !calendar->cells_valid) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  const ArgusSettings *settings = settings_get();

  int today_index = -1;
  for (int i = 0; i < 14; i++) {
    if (prv_is_today(&calendar->cells[i], calendar)) {
      today_index = i;
      break;
    }
  }
  if (today_index < 0) {
    return;
  }

  const CalendarGridLayout *layout = prv_ensure_grid_layout(calendar, bounds);
  GRect cell = prv_day_cell_rect(today_index, layout);
  bool is_holiday = settings->show_event_indicators && (calendar->event_mask & (1 << today_index));

  GFont today_font = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  GRect text_rect = prv_row_text_rect(cell, CALENDAR_DAY_LINE_HEIGHT);
  GRect pill = prv_day_pill_rect(text_rect, today_font, cell.size.w);

  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, pill, CALENDAR_TODAY_PILL_CORNER_RADIUS, GCornersAll);
  if (is_holiday) {
    prv_draw_holiday_frame(ctx, pill);
  }
  prv_draw_text(ctx, calendar->day_labels[today_index], today_font, text_rect, GTextAlignmentCenter, GColorBlack);
}

Calendar *calendar_create(Layer *parent) {
  Calendar *calendar = malloc(sizeof(Calendar));
  if (!calendar) {
    return NULL;
  }
  memset(calendar, 0, sizeof(*calendar));

  GRect bounds = layer_get_bounds(parent);
  calendar->layer = layer_create(GRect(0, 0, bounds.size.w, CALENDAR_HEIGHT));
  calendar->holiday_layer = layer_create(GRect(0, 0, bounds.size.w, CALENDAR_HEIGHT));
  calendar->today_layer = layer_create(GRect(0, 0, bounds.size.w, CALENDAR_HEIGHT));
  if (!calendar->layer || !calendar->holiday_layer || !calendar->today_layer) {
    calendar_destroy(calendar);
    return NULL;
  }

  layer_set_update_proc(calendar->layer, prv_calendar_update_proc);
  layer_set_update_proc(calendar->holiday_layer, prv_holiday_layer_update_proc);
  layer_add_child(calendar->layer, calendar->holiday_layer);
  layer_set_update_proc(calendar->today_layer, prv_today_layer_update_proc);
  layer_add_child(calendar->layer, calendar->today_layer);
  layer_add_child(parent, calendar->layer);

  time_t now = argus_time_now();
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
  calendar->layout_valid = false;
  calendar->layout_bounds_w = 0;
  calendar->month_label[0] = '\0';
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
  if (calendar->today_layer) {
    layer_destroy(calendar->today_layer);
  }
  if (calendar->holiday_layer) {
    layer_destroy(calendar->holiday_layer);
  }
  if (calendar->layer) {
    layer_destroy(calendar->layer);
  }
  free(calendar);
}

void calendar_set_bounds(Calendar *calendar, GRect frame) {
  if (!calendar) {
    return;
  }
  layer_set_frame(calendar->layer, frame);
  GRect layer_bounds = GRect(0, 0, frame.size.w, frame.size.h);
  layer_set_frame(calendar->holiday_layer, layer_bounds);
  layer_set_frame(calendar->today_layer, layer_bounds);
  calendar->layout_valid = false;
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
  prv_refresh_cells(calendar, now);
  prv_refresh_labels(calendar);
  prv_mark_calendar_dirty(calendar);
}

void calendar_set_event_days(Calendar *calendar, uint16_t event_mask) {
  if (!calendar) {
    return;
  }
  if (calendar->event_mask == event_mask) {
    return;
  }
  calendar->event_mask = event_mask;
  prv_mark_calendar_dirty(calendar);
}

