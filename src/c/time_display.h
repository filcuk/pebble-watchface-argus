#pragma once

#include <pebble.h>

#define TIME_BLOCK_HEIGHT 50

typedef struct TimeDisplay TimeDisplay;

TimeDisplay *time_display_create(Layer *parent);
void time_display_destroy(TimeDisplay *display);
void time_display_update(TimeDisplay *display, struct tm *now);
void time_display_set_bounds(TimeDisplay *display, GRect frame);
