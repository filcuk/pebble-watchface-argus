#pragma once

#include <pebble.h>

#define CALENDAR_HEIGHT 60

typedef struct Calendar Calendar;

Calendar *calendar_create(Layer *parent);
void calendar_destroy(Calendar *calendar);
void calendar_update(Calendar *calendar, struct tm *now);
void calendar_set_bounds(Calendar *calendar, GRect frame);
void calendar_set_event_days(Calendar *calendar, uint16_t event_mask);
