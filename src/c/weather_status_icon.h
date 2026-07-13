#pragma once

#include <pebble.h>

#include "weather.h"

#define WEATHER_STATUS_ICON_WIDTH 14
#define WEATHER_STATUS_ICON_HEIGHT 14

typedef enum {
  WEATHER_STATUS_ICON_NONE = 0,
  WEATHER_STATUS_ICON_ORANGE = 1,
  WEATHER_STATUS_ICON_RED = 2,
  WEATHER_STATUS_ICON_PURPLE = 3,
} WeatherStatusIconKind;

WeatherStatusIconKind weather_status_icon_kind(void);
void weather_status_icon_draw(GContext *ctx, int x, int y, WeatherStatusIconKind kind);
