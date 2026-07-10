#include "calendar.h"

#include "argus_time.h"
#include "settings.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

struct Calendar {
  Layer *layer;
  Layer *today_layer;
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

static GRect prv_row_text_rect(GRect cell, int line_height) {
  return GRect(cell.origin.x, cell.origin.y + (cell.size.h - line_height) / 2, cell.size.w, line_height);
}

static void prv_compute_grid_layout(GRect bounds, int *grid_left, int *col_w, int row_y[2]) {
  *grid_left = CALENDAR_WEEK_LABEL_WIDTH + CALENDAR_WEEK_COLUMN_GAP;
  int grid_w = bounds.size.w - *grid_left;
  *col_w = grid_w / 7;
  row_y[0] = CALENDAR_HEADER_HEIGHT + CALENDAR_HEADER_ROW_GAP;
  row_y[1] = CALENDAR_HEADER_HEIGHT + CALENDAR_HEADER_ROW_GAP + CALENDAR_ROW_HEIGHT + CALENDAR_WEEK_ROW_GAP;
}

static GRect prv_day_cell_rect(int index, int grid_left, int col_w, const int row_y[2]) {
  int row = index / 7;
  int col = index % 7;
  return GRect(grid_left + col * col_w + CALENDAR_CELL_PAD_H, row_y[row], col_w - CALENDAR_CELL_PAD_H * 2,
               CALENDAR_ROW_HEIGHT);
}

static void prv_mark_calendar_dirty(Calendar *calendar) {
  layer_mark_dirty(calendar->layer);
  layer_mark_dirty(calendar->today_layer);
}

static GSize prv_text_content_size(const char *text, GFont font, GRect bounds, GTextAlignment alignment) {
  return graphics_text_layout_get_content_size(text, font, bounds, GTextOverflowModeTrailingEllipsis, alignment);
}

static GRect prv_today_pill_rect(GRect text_rect, int text_w, int cell_w) {
  int w = text_w * CALENDAR_TODAY_PILL_WIDTH_MULTIPLIER;
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

  int grid_left;
  int col_w;
  int row_y[2];
  prv_compute_grid_layout(bounds, &grid_left, &col_w, row_y);

  GFont header_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  GFont day_font = fonts_get_system_font(FONT_KEY_GOTHIC_18);
  bool show_month_label = settings_show_calendar_month();

  if (show_month_label) {
    static char month_buf[8];
    GFont month_font = fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
    strftime(month_buf, sizeof(month_buf), "%b", &now);
    GRect month_cell =
        GRect(0, 0, CALENDAR_WEEK_LABEL_WIDTH - CALENDAR_SIDE_LABEL_INSET, CALENDAR_HEADER_HEIGHT);
    GRect month_text_rect = prv_row_text_rect(month_cell, CALENDAR_HEADER_LINE_HEIGHT);
    prv_draw_text(ctx, month_buf, month_font, month_text_rect, GTextAlignmentRight, GColorWhite);
  }

  for (int col = 0; col < 7; col++) {
    GRect header_cell = GRect(grid_left + col * col_w, 0, col_w, CALENDAR_HEADER_HEIGHT);
    GRect text_rect = prv_row_text_rect(header_cell, CALENDAR_HEADER_LINE_HEIGHT);
    prv_draw_text(ctx, labels[col], header_font, text_rect, GTextAlignmentCenter,
                  prv_is_weekend_column(col, settings->week_start) ? CALENDAR_WEEKEND_COLOR : GColorWhite);
  }

  static char week_buf[6];
  for (int row = 0; row < 2; row++) {
    int week = prv_week_number_for_date(&calendar->cells[row * 7], settings->week_number_mode);
    snprintf(week_buf, sizeof(week_buf), "W%d", week);
    GRect week_cell = GRect(0, row_y[row], CALENDAR_WEEK_LABEL_WIDTH - CALENDAR_SIDE_LABEL_INSET,
                            CALENDAR_ROW_HEIGHT);
    GRect text_rect = prv_row_text_rect(week_cell, CALENDAR_DAY_LINE_HEIGHT);
    prv_draw_text(ctx, week_buf, day_font, text_rect, GTextAlignmentRight, CALENDAR_WEEK_NUMBER_COLOR);
  }

  for (int i = 0; i < 14; i++) {
    GRect cell = prv_day_cell_rect(i, grid_left, col_w, row_y);
    bool today = prv_is_today(&calendar->cells[i], &now);
    bool has_event = settings->show_event_indicators && (calendar->event_mask & (1 << i));

    if (today) {
      continue;
    }

    static char day_buf[4];
    snprintf(day_buf, sizeof(day_buf), "%d", calendar->cells[i].tm_mday);

    GRect text_rect = prv_row_text_rect(cell, CALENDAR_DAY_LINE_HEIGHT);
    prv_draw_text(ctx, day_buf, day_font, text_rect, GTextAlignmentCenter,
                  prv_is_weekend(calendar->cells[i].tm_wday) ? CALENDAR_WEEKEND_COLOR : GColorWhite);

    if (has_event) {
      graphics_context_set_fill_color(ctx, GColorVividCerulean);
      graphics_fill_circle(ctx,
                           GPoint(cell.origin.x + cell.size.w / 2,
                                  cell.origin.y + cell.size.h - CALENDAR_EVENT_DOT_OFFSET_FROM_BOTTOM),
                           CALENDAR_EVENT_DOT_RADIUS);
    }
  }
}

static void prv_today_layer_update_proc(Layer *layer, GContext *ctx) {
  Calendar *calendar = s_calendar;
  if (!calendar) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, GColorClear);
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);

  if (!calendar->cells_valid) {
    return;
  }

  const ArgusSettings *settings = settings_get();

  struct tm now = {0};
  now.tm_year = calendar->year;
  now.tm_mon = calendar->month;
  now.tm_mday = calendar->day;
  mktime(&now);

  int today_index = -1;
  for (int i = 0; i < 14; i++) {
    if (prv_is_today(&calendar->cells[i], &now)) {
      today_index = i;
      break;
    }
  }
  if (today_index < 0) {
    return;
  }

  int grid_left;
  int col_w;
  int row_y[2];
  prv_compute_grid_layout(bounds, &grid_left, &col_w, row_y);

  GRect cell = prv_day_cell_rect(today_index, grid_left, col_w, row_y);
  bool has_event = settings->show_event_indicators && (calendar->event_mask & (1 << today_index));

  static char day_buf[4];
  snprintf(day_buf, sizeof(day_buf), "%d", calendar->cells[today_index].tm_mday);

  GFont today_font = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  GRect text_rect = prv_row_text_rect(cell, CALENDAR_DAY_LINE_HEIGHT);
  GSize text_size = prv_text_content_size(day_buf, today_font, text_rect, GTextAlignmentCenter);
  GRect pill = prv_today_pill_rect(text_rect, text_size.w, cell.size.w);

  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, pill, CALENDAR_TODAY_PILL_CORNER_RADIUS, GCornersAll);
  prv_draw_text(ctx, day_buf, today_font, text_rect, GTextAlignmentCenter, GColorBlack);

  if (has_event) {
    graphics_context_set_fill_color(ctx, GColorBlack);
    graphics_fill_circle(ctx,
                         GPoint(cell.origin.x + cell.size.w / 2,
                                cell.origin.y + cell.size.h - CALENDAR_EVENT_DOT_OFFSET_FROM_BOTTOM),
                         CALENDAR_EVENT_DOT_RADIUS);
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

  calendar->today_layer = layer_create(GRect(0, 0, bounds.size.w, CALENDAR_HEIGHT));
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
  layer_set_frame(calendar->today_layer, GRect(0, 0, frame.size.w, frame.size.h));
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

