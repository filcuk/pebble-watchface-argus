#pragma once

#include <pebble.h>

#define WEATHER_CHART_HEIGHT 96
#define WEATHER_CHART_MIN_HEIGHT 52

typedef struct WeatherChart WeatherChart;

WeatherChart *weather_chart_create(Layer *parent);
void weather_chart_destroy(WeatherChart *chart);
void weather_chart_set_bounds(WeatherChart *chart, GRect frame);
void weather_chart_refresh(WeatherChart *chart);
