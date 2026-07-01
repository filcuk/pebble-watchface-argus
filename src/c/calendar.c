#include "calendar.h"

#include "settings.h"

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

  int col_w = bounds.size.w / 7;
  int header_h = 14;
  int row_h = (bounds.size.h - header_h) / 2;

  graphics_context_set_text_color(ctx, GColorWhite);
  for (int col = 0; col < 7; col++) {
    graphics_draw_text(ctx, labels[col], fonts_get_system_font(FONT_KEY_GOTHIC_14),
                       GRect(col * col_w, 0, col_w, header_h), GTextOverflowModeTrailingEllipsis,
                       GTextAlignmentCenter, NULL);
  }

  for (int i = 0; i < 14; i++) {
    int row = i / 7;
    int col = i % 7;
    GRect cell = GRect(col * col_w + 1, header_h + row * row_h + 1, col_w - 2, row_h - 2);
    bool today = prv_is_today(&cells[i], &now);
    bool has_event = settings->show_event_indicators && (calendar->event_mask & (1 << i));

    if (today) {
      graphics_context_set_fill_color(ctx, GColorWhite);
      graphics_fill_rect(ctx, cell, 2, GCornersAll);
      graphics_context_set_text_color(ctx, GColorBlack);
    } else {
      graphics_context_set_text_color(ctx, GColorWhite);
    }

    static char day_buf[4];
    snprintf(day_buf, sizeof(day_buf), "%d", cells[i].tm_mday);
    graphics_draw_text(ctx, day_buf, fonts_get_system_font(FONT_KEY_GOTHIC_14), cell,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);

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
