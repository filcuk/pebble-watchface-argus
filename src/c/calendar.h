#pragma once

#include <pebble.h>

#define CALENDAR_WEEK_LABEL_WIDTH 28
#define CALENDAR_WEEK_COLUMN_GAP 4
#define CALENDAR_SIDE_LABEL_INSET 1
#define CALENDAR_HEADER_HEIGHT 16
#define CALENDAR_HEADER_LINE_HEIGHT 14
#define CALENDAR_ROW_HEIGHT 20
#define CALENDAR_HEADER_ROW_GAP -4
#define CALENDAR_WEEK_ROW_GAP -4
#define CALENDAR_CELL_PAD_H 1
#define CALENDAR_DAY_LINE_HEIGHT 18
#define CALENDAR_TODAY_PILL_CORNER_RADIUS 2
#define CALENDAR_TODAY_PILL_INK_HEIGHT 7
#define CALENDAR_TODAY_PILL_PAD_V 4
#define CALENDAR_TODAY_PILL_Y_OFFSET -2
#define CALENDAR_TODAY_PILL_WIDTH_MULTIPLIER 2.5
#define CALENDAR_BOTTOM_PAD 2
#define CALENDAR_EVENT_DOT_RADIUS 2
#define CALENDAR_EVENT_DOT_OFFSET_FROM_BOTTOM 4
#define CALENDAR_HOLIDAY_FRAME_COLOR GColorVividCerulean
#define CALENDAR_HOLIDAY_FRAME_WIDTH 1
#define CALENDAR_WEEKEND_COLOR GColorSunsetOrange
#define CALENDAR_WEEK_NUMBER_COLOR GColorLightGray
#define CALENDAR_HEIGHT                                                                                              \
  (CALENDAR_HEADER_HEIGHT + CALENDAR_HEADER_ROW_GAP + CALENDAR_ROW_HEIGHT + CALENDAR_WEEK_ROW_GAP +                  \
   CALENDAR_ROW_HEIGHT + CALENDAR_BOTTOM_PAD)

typedef struct Calendar Calendar;

Calendar *calendar_create(Layer *parent);
void calendar_destroy(Calendar *calendar);
void calendar_update(Calendar *calendar, struct tm *now);
void calendar_invalidate(Calendar *calendar);
void calendar_set_bounds(Calendar *calendar, GRect frame);
void calendar_set_event_days(Calendar *calendar, uint16_t event_mask);
