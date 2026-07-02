#include "weather_chart.h"

#include "settings.h"
#include "weather.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

struct WeatherChart {
  Layer *layer;
  GPoint temp_points[WEATHER_MAX_HOURS];
  uint8_t point_count;
};

static WeatherChart *s_weather_chart;

#define CHART_MARGIN_H 4
#define Y_LABEL_WIDTH 14
#define Y_LABEL_HEIGHT 14
#define X_TICK_HEIGHT 2
#define X_LABEL_GAP 2
#define X_LABEL_HEIGHT 14
#define CHART_MARGIN_TOP 2
#define CHART_MARGIN_BOTTOM 2
#define X_AXIS_HEIGHT (X_TICK_HEIGHT + X_LABEL_GAP + X_LABEL_HEIGHT)
#define X_MINOR_NOTCH_HEIGHT 1
#define WIND_X_ARM 2
#define NIGHT_HATCH_SPACING 8
#define Y_AXIS_FLOOR_PADDING 1

static int8_t prv_display_temp(int8_t celsius) {
  const ArgusSettings *settings = settings_get();
  if (!settings->temperature_fahrenheit) {
    return celsius;
  }
  return (int8_t)(((celsius * 9) + (celsius >= 0 ? 2 : -2)) / 5 + 32);
}

static time_t prv_forecast_time_for_index(const WeatherData *data, int index) {
  time_t base = data->fetch_time > 0 ? data->fetch_time : time(NULL);
  return base + (time_t)index * 3600;
}

static void prv_format_time_label(char *buf, size_t len, time_t when) {
  struct tm *tm = localtime(&when);
  if (!tm) {
    if (len > 0) {
      buf[0] = '\0';
    }
    return;
  }

  const ArgusSettings *settings = settings_get();
  bool use_24h = settings->hour_format == HOUR_FORMAT_24H ||
                 (settings->hour_format == HOUR_FORMAT_SYSTEM && clock_is_24h_style());

  if (use_24h) {
    snprintf(buf, len, "%d", tm->tm_hour);
  } else {
    int hour = tm->tm_hour % 12;
    if (hour == 0) {
      hour = 12;
    }
    snprintf(buf, len, "%d", hour);
  }
}

static bool prv_use_24h_time(void) {
  const ArgusSettings *settings = settings_get();
  return settings->hour_format == HOUR_FORMAT_24H ||
         (settings->hour_format == HOUR_FORMAT_SYSTEM && clock_is_24h_style());
}

static bool prv_is_even_hour_major(time_t when) {
  struct tm *tm = localtime(&when);
  if (!tm) {
    return false;
  }

  if (prv_use_24h_time()) {
    return (tm->tm_hour % 2) == 0;
  }

  int hour = tm->tm_hour % 12;
  if (hour == 0) {
    hour = 12;
  }
  return (hour % 2) == 0;
}

static void prv_format_temp_label(char *buf, size_t len, int8_t temp) {
  snprintf(buf, len, "%d", (int)temp);
}

static int prv_plot_x(int plot_left, int plot_w, int index, int hour_count) {
  if (hour_count <= 1) {
    return plot_left + plot_w / 2;
  }
  return plot_left + (index * plot_w) / (hour_count - 1);
}

static int prv_plot_y(int plot_top, int plot_h, int8_t temp, int8_t min_temp, int8_t max_temp) {
  return plot_top + plot_h - ((temp - min_temp) * plot_h) / (max_temp - min_temp);
}

static int prv_precip_y(int plot_bottom, int plot_h, uint8_t precip, uint8_t precip_max) {
  return plot_bottom - (precip * plot_h) / precip_max;
}

static int prv_wind_y(int plot_bottom, int plot_h, uint8_t wind, uint8_t wind_max) {
  return plot_bottom - (wind * plot_h) / wind_max;
}

static void prv_draw_wind_x(GContext *ctx, GPoint center, int arm) {
  graphics_context_set_stroke_color(ctx, GColorLightGray);
  graphics_context_set_stroke_width(ctx, 1);
  graphics_draw_line(ctx, GPoint(center.x - arm, center.y - arm), GPoint(center.x + arm, center.y + arm));
  graphics_draw_line(ctx, GPoint(center.x - arm, center.y + arm), GPoint(center.x + arm, center.y - arm));
}

static void prv_draw_wind_marks(GContext *ctx, const WeatherData *data, int plot_left, int plot_w, int axis_y,
                                int plot_h, uint8_t wind_max) {
  if (!data->has_wind) {
    return;
  }

  for (int i = 0; i < data->hour_count; i++) {
    if (data->winds[i] == 0) {
      continue;
    }

    int x = prv_plot_x(plot_left, plot_w, i, data->hour_count);
    int y = prv_wind_y(axis_y, plot_h, data->winds[i], wind_max);
    prv_draw_wind_x(ctx, GPoint(x, y), WIND_X_ARM);
  }
}

static bool prv_is_night(const WeatherData *data, int index) {
  if (data->has_is_day && index < data->hour_count) {
    return data->is_day[index] == 0;
  }
  time_t when = prv_forecast_time_for_index(data, index);
  struct tm *tm = localtime(&when);
  if (!tm) {
    return false;
  }
  return tm->tm_hour < 6 || tm->tm_hour >= 20;
}

static int prv_segment_left(int plot_left, int plot_right, int plot_w, int index, int hour_count) {
  if (index == 0) {
    return plot_left;
  }
  return (prv_plot_x(plot_left, plot_w, index - 1, hour_count) + prv_plot_x(plot_left, plot_w, index, hour_count)) / 2;
}

static int prv_segment_right(int plot_left, int plot_right, int plot_w, int index, int hour_count) {
  if (index >= hour_count - 1) {
    return plot_right;
  }
  return (prv_plot_x(plot_left, plot_w, index, hour_count) + prv_plot_x(plot_left, plot_w, index + 1, hour_count)) / 2;
}

static void prv_draw_precip_bars(GContext *ctx, const WeatherData *data, int plot_left, int plot_right, int plot_w,
                                 int axis_y, int plot_h, uint8_t precip_max) {
  graphics_context_set_fill_color(ctx, GColorVividCerulean);

  for (int i = 0; i < data->hour_count; i++) {
    if (data->precips[i] == 0) {
      continue;
    }

    int left = prv_segment_left(plot_left, plot_right, plot_w, i, data->hour_count);
    int right = prv_segment_right(plot_left, plot_right, plot_w, i, data->hour_count);
    int bar_w = right - left;
    if (bar_w < 1) {
      continue;
    }

    int top = prv_precip_y(axis_y, plot_h, data->precips[i], precip_max);
    int bar_h = axis_y - top;
    if (bar_h < 1) {
      bar_h = 1;
    }

    int inset = bar_w > 3 ? 1 : 0;
    graphics_fill_rect(ctx, GRect(left + inset, top, bar_w - 2 * inset, bar_h), 0, GCornerNone);
  }
}

static GRect prv_night_region_rect(const WeatherData *data, int plot_left, int plot_right, int plot_w, int plot_top,
                                   int plot_bottom, int run_start, int run_end) {
  int left = run_start == 0 ? plot_left
                            : prv_segment_left(plot_left, plot_right, plot_w, run_start, data->hour_count);
  int right = run_end >= (int)data->hour_count - 1
                              ? plot_right
                              : prv_segment_right(plot_left, plot_right, plot_w, run_end, data->hour_count);
  return GRect(left, plot_top, right - left, plot_bottom - plot_top);
}

static void prv_draw_hatch_in_region(GContext *ctx, GRect rect) {
  if (rect.size.w <= 0 || rect.size.h <= 0) {
    return;
  }

  int left = rect.origin.x;
  int top = rect.origin.y;
  int right = rect.origin.x + rect.size.w;
  int bottom = rect.origin.y + rect.size.h;
  int w = rect.size.w;
  int h = rect.size.h;

  graphics_context_set_stroke_color(ctx, GColorDarkGray);
  graphics_context_set_stroke_width(ctx, 1);
  const int spacing = NIGHT_HATCH_SPACING;

  for (int offset = -h; offset < w + h; offset += spacing) {
    int x1 = left + offset;
    int y1 = top;
    int x2 = left + offset + h;
    int y2 = bottom;

    if (x1 < left) {
      y1 += left - x1;
      x1 = left;
    }
    if (x2 > right) {
      y2 -= x2 - right;
      x2 = right;
    }
    if (y1 < top) {
      x1 += top - y1;
      y1 = top;
    }
    if (y2 > bottom) {
      x2 -= y2 - bottom;
      y2 = bottom;
    }

    if (x1 > right || x2 < left || y1 > bottom || y2 < top || x1 > x2 || y1 > y2) {
      continue;
    }

    graphics_draw_line(ctx, GPoint(x1, y1), GPoint(x2, y2));
  }
}

static void prv_draw_night_region(GContext *ctx, GRect region) {
  if (region.size.w <= 0 || region.size.h <= 0) {
    return;
  }

  int left = region.origin.x;
  int top = region.origin.y;
  int right = region.origin.x + region.size.w;
  int bottom = region.origin.y + region.size.h;

  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, region, 0, GCornerNone);
  prv_draw_hatch_in_region(ctx, region);

  graphics_context_set_stroke_color(ctx, GColorDarkGray);
  graphics_draw_line(ctx, GPoint(left, top), GPoint(left, bottom));
  graphics_draw_line(ctx, GPoint(right, top), GPoint(right, bottom));
}

static void prv_draw_night_regions(GContext *ctx, const WeatherData *data, int plot_left, int plot_right, int plot_top,
                                   int plot_bottom, int plot_w) {
  int run_start = -1;

  for (int i = 0; i <= data->hour_count; i++) {
    bool night = i < data->hour_count && prv_is_night(data, i);

    if (night && run_start < 0) {
      run_start = i;
    }

    if ((!night || i == data->hour_count) && run_start >= 0) {
      int end_index = night ? i : i - 1;
      GRect region = prv_night_region_rect(data, plot_left, plot_right, plot_w, plot_top, plot_bottom, run_start,
                                           end_index);
      prv_draw_night_region(ctx, region);
      run_start = -1;
    }
  }
}

static void prv_draw_y_axis_ticks(GContext *ctx, GFont font, int plot_left, int plot_top, int plot_h, int8_t min_temp,
                                  int8_t max_temp) {
  static char label[8];
  static const int y_label_count = 3;

  for (int t = 0; t <= y_label_count; t++) {
    int8_t temp = max_temp - (int8_t)(((max_temp - min_temp) * t) / y_label_count);
    int y = prv_plot_y(plot_top, plot_h, temp, min_temp, max_temp);

    graphics_context_set_stroke_color(ctx, GColorDarkGray);
    graphics_draw_line(ctx, GPoint(plot_left - 3, y), GPoint(plot_left, y));

    prv_format_temp_label(label, sizeof(label), temp);
    graphics_context_set_text_color(ctx, GColorWhite);
    graphics_draw_text(ctx, label, font,
                       GRect(CHART_MARGIN_H, y - Y_LABEL_HEIGHT / 2, Y_LABEL_WIDTH - 1, Y_LABEL_HEIGHT),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
  }
}

static void prv_draw_x_axis(GContext *ctx, const WeatherData *data, GFont font, int plot_left, int plot_w, int axis_y) {
  static char label[8];
  static const int label_w = 14;

  for (int hour = 0; hour < data->hour_count; hour++) {
    time_t when = prv_forecast_time_for_index(data, hour);
    int x = prv_plot_x(plot_left, plot_w, hour, data->hour_count);

    if (prv_is_even_hour_major(when)) {
      graphics_context_set_stroke_color(ctx, GColorDarkGray);
      graphics_draw_line(ctx, GPoint(x, axis_y), GPoint(x, axis_y + X_TICK_HEIGHT));

      prv_format_time_label(label, sizeof(label), when);
      graphics_context_set_text_color(ctx, GColorWhite);
      graphics_draw_text(ctx, label, font,
                         GRect(x - label_w / 2, axis_y + X_TICK_HEIGHT + X_LABEL_GAP, label_w, X_LABEL_HEIGHT),
                         GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    } else {
      graphics_context_set_stroke_color(ctx, GColorDarkGray);
      graphics_draw_line(ctx, GPoint(x, axis_y), GPoint(x, axis_y + X_MINOR_NOTCH_HEIGHT));
    }
  }
}

static void prv_weather_chart_update_proc(Layer *layer, GContext *ctx) {
  (void)layer;
  WeatherChart *chart = s_weather_chart;
  if (!chart) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  WeatherData *data = weather_get();

  graphics_context_set_text_color(ctx, GColorWhite);
  if (data->state == WEATHER_STATE_LOADING) {
    graphics_draw_text(ctx, "Loading weather...", fonts_get_system_font(FONT_KEY_GOTHIC_18), bounds,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  if (data->state == WEATHER_STATE_ERROR || data->hour_count == 0) {
    graphics_draw_text(ctx, "No weather data", fonts_get_system_font(FONT_KEY_GOTHIC_18), bounds,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  int plot_left = CHART_MARGIN_H + Y_LABEL_WIDTH;
  int plot_right = bounds.size.w - CHART_MARGIN_H;
  int plot_w = plot_right - plot_left;
  int plot_top = CHART_MARGIN_TOP;
  int axis_y = bounds.size.h - CHART_MARGIN_BOTTOM - X_AXIS_HEIGHT - Y_LABEL_HEIGHT / 2;
  int plot_h = axis_y - plot_top;
  if (plot_w < 8) {
    plot_w = 8;
  }
  if (plot_h < 8) {
    plot_h = 8;
  }

  int8_t min_temp = prv_display_temp(data->temp_min);
  int8_t max_temp = prv_display_temp(data->temp_max);
  if (max_temp <= min_temp) {
    max_temp = min_temp + 1;
  }
  int8_t axis_min = (int8_t)(min_temp - Y_AXIS_FLOOR_PADDING);
  int8_t axis_max = max_temp;
  if (axis_max <= axis_min) {
    axis_max = axis_min + 1;
  }

  uint8_t precip_max = data->precip_max;
  if (precip_max == 0) {
    precip_max = 1;
  }

  uint8_t wind_max = data->wind_max;
  if (wind_max == 0) {
    wind_max = 1;
  }

  chart->point_count = data->hour_count;
  prv_draw_precip_bars(ctx, data, plot_left, plot_right, plot_w, axis_y, plot_h, precip_max);

  prv_draw_night_regions(ctx, data, plot_left, plot_right, plot_top, axis_y, plot_w);

  prv_draw_wind_marks(ctx, data, plot_left, plot_w, axis_y, plot_h, wind_max);

  GFont axis_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);

  graphics_context_set_stroke_color(ctx, GColorDarkGray);
  graphics_draw_line(ctx, GPoint(plot_left, plot_top), GPoint(plot_left, axis_y));
  graphics_draw_line(ctx, GPoint(plot_left, axis_y), GPoint(plot_right, axis_y));

  prv_draw_y_axis_ticks(ctx, axis_font, plot_left, plot_top, plot_h, axis_min, axis_max);

  for (int i = 0; i < data->hour_count; i++) {
    int8_t temp = prv_display_temp(data->temps[i]);
    chart->temp_points[i] = GPoint(prv_plot_x(plot_left, plot_w, i, data->hour_count),
                                   prv_plot_y(plot_top, plot_h, temp, axis_min, axis_max));
  }

  if (chart->point_count >= 2) {
    GPathInfo path_info = {
        .num_points = chart->point_count,
        .points = chart->temp_points,
    };
    GPath *path = gpath_create(&path_info);
    graphics_context_set_stroke_color(ctx, GColorOrange);
    graphics_context_set_stroke_width(ctx, 2);
    gpath_draw_outline_open(ctx, path);
    gpath_destroy(path);
  }

  graphics_context_set_fill_color(ctx, GColorOrange);
  for (int i = 0; i < chart->point_count; i++) {
    graphics_fill_circle(ctx, chart->temp_points[i], 1);
  }

  prv_draw_x_axis(ctx, data, axis_font, plot_left, plot_w, axis_y);
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
