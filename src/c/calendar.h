#pragma once

#include <pebble.h>

#define CALENDAR_WEEK_LABEL_WIDTH 18
#define CALENDAR_HEADER_HEIGHT 14
#define CALENDAR_ROW_HEIGHT 16
#define CALENDAR_ROW_GAP 1
#define CALENDAR_HEIGHT                                                                                              \
  (CALENDAR_HEADER_HEIGHT + CALENDAR_ROW_GAP + CALENDAR_ROW_HEIGHT + CALENDAR_ROW_GAP + CALENDAR_ROW_HEIGHT)

typedef struct Calendar Calendar;

Calendar *calendar_create(Layer *parent);
void calendar_destroy(Calendar *calendar);
void calendar_update(Calendar *calendar, struct tm *now);
void calendar_set_bounds(Calendar *calendar, GRect frame);
void calendar_set_event_days(Calendar *calendar, uint16_t event_mask);
