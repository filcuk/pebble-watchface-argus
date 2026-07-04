#pragma once

#include <pebble.h>

#define TIME_BLOCK_HEIGHT 64
#define TIME_CALENDAR_GAP 0
#define TIME_WEATHER_GAP 16

typedef struct TimeDisplay TimeDisplay;

TimeDisplay *time_display_create(Layer *parent);
void time_display_destroy(TimeDisplay *display);
void time_display_update(TimeDisplay *display, struct tm *now);
void time_display_set_bounds(TimeDisplay *display, GRect frame);
