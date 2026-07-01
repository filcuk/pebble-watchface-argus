#include "weather_chart.h"

#include "settings.h"
#include "weather.h"

#include <stdio.h>
#include <string.h>

struct WeatherChart {
  Layer *layer;
  GPoint temp_points[WEATHER_MAX_HOURS];
  uint8_t point_count;
};

static WeatherChart *s_weather_chart;

static int8_t prv_display_temp(int8_t celsius) {
  const ArgusSettings *settings = settings_get();
  if (!settings->temperature_fahrenheit) {
    return celsius;
  }
  return (int8_t)(((celsius * 9) + (celsius >= 0 ? 2 : -2)) / 5 + 32);
}

static void prv_weather_chart_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  WeatherChart *chart = s_weather_chart;
  if (!chart) {
    return;
  }
  GRect bounds = layer_get_bounds(layer);
  WeatherData *data = weather_get();

  int chart_top = 14;
  int chart_h = bounds.size.h - chart_top - 4;
  int precip_h = chart_h / 3;
  int temp_h = chart_h - precip_h - 4;

  graphics_context_set_text_color(ctx, GColorWhite);
  if (data->state == WEATHER_STATE_LOADING) {
    graphics_draw_text(ctx, "Loading weather...", fonts_get_system_font(FONT_KEY_GOTHIC_18),
                       bounds, GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  if (data->state == WEATHER_STATE_ERROR || data->hour_count == 0) {
    graphics_draw_text(ctx, "No weather data", fonts_get_system_font(FONT_KEY_GOTHIC_18), bounds,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  static char label[16];
  snprintf(label, sizeof(label), "%dh forecast", data->hour_count);
  graphics_draw_text(ctx, label, fonts_get_system_font(FONT_KEY_GOTHIC_14), GRect(4, 0, bounds.size.w - 8, 14),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);

  int8_t min_temp = data->temp_min;
  int8_t max_temp = data->temp_max;
  if (max_temp <= min_temp) {
    max_temp = min_temp + 1;
  }

  int col_w = bounds.size.w / (int)data->hour_count;
  if (col_w < 1) {
    col_w = 1;
  }

  GRect precip_area = GRect(0, chart_top + temp_h + 4, bounds.size.w, precip_h);
  uint8_t precip_max = data->precip_max;
  if (precip_max == 0) {
    precip_max = 1;
  }

  for (int i = 0; i < data->hour_count; i++) {
    int bar_h = (data->precips[i] * precip_area.size.h) / precip_max;
    if (bar_h > 0) {
      graphics_context_set_fill_color(ctx, GColorVividCerulean);
      graphics_fill_rect(ctx,
                         GRect(precip_area.origin.x + i * col_w + 1, precip_area.origin.y + precip_area.size.h - bar_h,
                               col_w - 1, bar_h),
                         0, GCornerNone);
    }
  }

  chart->point_count = data->hour_count;
  for (int i = 0; i < data->hour_count; i++) {
    int8_t temp = prv_display_temp(data->temps[i]);
    int y = chart_top + temp_h - ((temp - min_temp) * temp_h) / (max_temp - min_temp);
    chart->temp_points[i] = GPoint(i * col_w + col_w / 2, y);
  }

  if (chart->point_count >= 2) {
    GPathInfo path_info = {
        .num_points = chart->point_count,
        .points = chart->temp_points,
    };
    GPath *path = gpath_create(&path_info);
    graphics_context_set_stroke_color(ctx, GColorMelon);
    graphics_context_set_stroke_width(ctx, 2);
    gpath_draw_outline_open(ctx, path);
    gpath_destroy(path);
  }

  graphics_context_set_fill_color(ctx, GColorMelon);
  for (int i = 0; i < chart->point_count; i++) {
    graphics_fill_circle(ctx, chart->temp_points[i], 1);
  }
}

WeatherChart *weather_chart_create(Layer *parent) {
  WeatherChart *chart = malloc(sizeof(WeatherChart));
  if (!chart) {
    return NULL;
  }

  GRect bounds = layer_get_bounds(parent);
  chart->layer = layer_create(GRect(0, bounds.size.h - WEATHER_CHART_HEIGHT, bounds.size.w, WEATHER_CHART_HEIGHT));
  layer_set_update_proc(chart->layer, prv_weather_chart_update_proc);
  layer_add_child(parent, chart->layer);
  chart->point_count = 0;
  s_weather_chart = chart;
  return chart;
}

void weather_chart_destroy(WeatherChart *chart) {
  if (!chart) {
    return;
  }
  if (s_weather_chart == chart) {
    s_weather_chart = NULL;
  }
  layer_destroy(chart->layer);
  free(chart);
}

void weather_chart_set_bounds(WeatherChart *chart, GRect frame) {
  if (!chart) {
    return;
  }
  layer_set_frame(chart->layer, frame);
}

void weather_chart_refresh(WeatherChart *chart) {
  if (!chart) {
    return;
  }
  layer_mark_dirty(chart->layer);
}
