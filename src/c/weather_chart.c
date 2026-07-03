#include "weather_chart.h"

#include "formatting.h"
#include "weather.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

struct WeatherChart {
  Layer *layer;
  Layer *plot_layer;
  Layer *decor_layer;
  GPoint temp_points[WEATHER_MAX_HOURS];
  uint8_t point_count;
};

typedef struct {
  int plot_left;
  int plot_right;
  int plot_top;
  int axis_y;
  int plot_w;
  int plot_h;
} ChartGeometry;

typedef struct {
  int plot_left;
  int plot_right;
  int plot_top;
  int axis_y;
  int plot_w;
  int plot_h;
  int8_t axis_min;
  int8_t axis_max;
  uint8_t precip_max;
  uint8_t wind_max;
  bool ready;
} ChartLayout;

static WeatherChart *s_weather_chart;

#define CHART_MARGIN_H 4
#define CHART_MARGIN_RIGHT 6
#define Y_LABEL_WIDTH 14
#define Y_LABEL_HEIGHT 14
#define Y_LABEL_AXIS_GAP 3
#define Y_LABEL_Y_OFFSET -3
#define Y_MAJOR_LABEL_INTERVALS 3
#define Y_MINOR_TICKS_PER_INTERVAL 1
#define Y_MAJOR_TICK_LENGTH 3
#define Y_MAJOR_TICK_THICKNESS 1
#define Y_MINOR_TICK_LENGTH 2
#define X_MAJOR_LABEL_INTERVALS 2
#define X_LABEL_REFERENCE_HOURS 24
#define X_MINOR_TICKS_PER_INTERVAL 1
#define X_MAJOR_TICK_LENGTH 3
#define X_MAJOR_TICK_THICKNESS 1
#define X_MINOR_TICK_LENGTH 2
#define X_TICK_TO_LABEL_GAP 1
#define X_LABEL_Y_OFFSET -3
#define X_LABEL_HEIGHT 14
#define CHART_MARGIN_TOP 2
#define CHART_MARGIN_TOP_PAD 1
#define Y_LABEL_HEADROOM (((Y_LABEL_HEIGHT / 2) - Y_LABEL_Y_OFFSET) + CHART_MARGIN_TOP_PAD)
#define CHART_PLOT_TOP (Y_LABEL_HEADROOM + CHART_MARGIN_TOP)
#define CHART_MARGIN_BOTTOM 2
#define X_AXIS_HEIGHT (X_MAJOR_TICK_LENGTH + X_TICK_TO_LABEL_GAP + X_LABEL_HEIGHT + X_LABEL_Y_OFFSET)
#define WIND_X_ARM 2
#define NIGHT_HATCH_SPACING 12
#define Y_AXIS_FLOOR_PADDING 1
#define CHART_AXIS_COLOR GColorDarkGray
#define CHART_TICK_COLOR GColorDarkGray
#define CHART_LABEL_COLOR GColorWhite
#define CHART_STATUS_TEXT_COLOR GColorWhite
#define TEMP_LINE_COLOR GColorRed
#define TEMP_POINT_COLOR GColorRed
#define PRECIP_BAR_COLOR GColorVividCerulean
#define WIND_MARK_COLOR GColorLightGray
#define NIGHT_FILL_COLOR GColorBlack
#define NIGHT_HATCH_COLOR GColorDarkGray
#define NIGHT_BORDER_COLOR GColorDarkGray
#define TEMP_LINE_STROKE_WIDTH 2
#define TEMP_POINT_RADIUS 1
#define PLOT_TOP_OVERFLOW ((TEMP_LINE_STROKE_WIDTH / 2) + TEMP_POINT_RADIUS + 1)

static void prv_chart_geometry(GRect bounds, ChartGeometry *geo) {
  int plot_left = CHART_MARGIN_H + Y_LABEL_WIDTH + Y_LABEL_AXIS_GAP;
  int plot_right = bounds.size.w - CHART_MARGIN_RIGHT - WIND_X_ARM;
  int plot_w = plot_right - plot_left;
  int plot_top = CHART_PLOT_TOP;
  int axis_y = bounds.size.h - CHART_MARGIN_BOTTOM - X_AXIS_HEIGHT - Y_LABEL_HEIGHT / 2;
  int plot_h = axis_y - plot_top;
  if (plot_w < 8) {
    plot_w = 8;
  }
  if (plot_h < 8) {
    plot_h = 8;
  }

  geo->plot_left = plot_left;
  geo->plot_right = plot_right;
  geo->plot_top = plot_top;
  geo->axis_y = axis_y;
  geo->plot_w = plot_w;
  geo->plot_h = plot_h;
}

static bool prv_compute_layout(GRect bounds, const WeatherData *data, ChartLayout *layout) {
  ChartGeometry geo;
  prv_chart_geometry(bounds, &geo);

  int8_t min_temp = formatting_display_temp(data->temp_min);
  int8_t max_temp = formatting_display_temp(data->temp_max);
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

  layout->plot_left = geo.plot_left;
  layout->plot_right = geo.plot_right;
  layout->plot_top = geo.plot_top;
  layout->axis_y = geo.axis_y;
  layout->plot_w = geo.plot_w;
  layout->plot_h = geo.plot_h;
  layout->axis_min = axis_min;
  layout->axis_max = axis_max;
  layout->precip_max = precip_max;
  layout->wind_max = wind_max;
  layout->ready = true;
  return true;
}

static void prv_sync_plot_layer_frame(WeatherChart *chart, GRect decor_bounds) {
  ChartGeometry geo;
  prv_chart_geometry(decor_bounds, &geo);
  layer_set_frame(chart->plot_layer,
                  GRect(geo.plot_left, geo.plot_top - PLOT_TOP_OVERFLOW, geo.plot_w, geo.plot_h + PLOT_TOP_OVERFLOW));
}

static time_t prv_forecast_time_for_index(const WeatherData *data, int index) {
  time_t base = data->fetch_time > 0 ? data->fetch_time : time(NULL);
  return base + (time_t)index * 3600;
}

static void prv_format_time_label(char *buf, size_t len, time_t when) {
  struct tm *tm = localtime(&when);
  formatting_clock_hour_label(buf, len, tm);
}

static bool prv_is_even_clock_hour(time_t when) {
  struct tm *tm = localtime(&when);
  if (!tm) {
    return false;
  }

  if (formatting_use_24h()) {
    return (tm->tm_hour % 2) == 0;
  }

  int hour = tm->tm_hour % 12;
  if (hour == 0) {
    hour = 12;
  }
  return (hour % 2) == 0;
}

static bool prv_is_interior_hour_index(int hour, int hour_count) {
  return hour > 0 && hour < hour_count - 1;
}

static int prv_x_label_target_count(const WeatherData *data) {
  int count = 0;
  for (int hour = 1; hour < X_LABEL_REFERENCE_HOURS - 1; hour++) {
    time_t when = prv_forecast_time_for_index(data, hour);
    if (prv_is_even_clock_hour(when)) {
      count++;
    }
  }
  return count;
}

static bool prv_is_x_label_index(const WeatherData *data, int hour) {
  int hour_count = (int)data->hour_count;
  if (hour < 0 || hour >= hour_count) {
    return false;
  }

  int target = prv_x_label_target_count(data);
  if (target <= 0 || hour_count <= 0) {
    return false;
  }

  if (target >= hour_count) {
    if (!prv_is_interior_hour_index(hour, hour_count)) {
      return false;
    }
    time_t when = prv_forecast_time_for_index(data, hour);
    return prv_is_even_clock_hour(when);
  }

  if (hour_count == X_LABEL_REFERENCE_HOURS) {
    if (!prv_is_interior_hour_index(hour, hour_count)) {
      return false;
    }
    time_t when = prv_forecast_time_for_index(data, hour);
    return prv_is_even_clock_hour(when);
  }

  if (target == 1) {
    return hour == hour_count / 2;
  }

  for (int i = 0; i < target; i++) {
    int label_hour = (i * (hour_count - 1) + (target - 1) / 2) / (target - 1);
    if (hour == label_hour) {
      return true;
    }
  }
  return false;
}

static bool prv_is_x_major_tick_index(const WeatherData *data, int hour) {
  return prv_is_x_label_index(data, hour);
}

static bool prv_is_x_minor_tick_index(const WeatherData *data, int hour) {
  int hour_count = (int)data->hour_count;
  if (!prv_is_interior_hour_index(hour, hour_count)) {
    return false;
  }
  if (prv_is_x_major_tick_index(data, hour)) {
    return false;
  }

  int target = prv_x_label_target_count(data);
  if (target >= hour_count || hour_count == X_LABEL_REFERENCE_HOURS) {
    time_t when = prv_forecast_time_for_index(data, hour);
    return !prv_is_even_clock_hour(when);
  }

  return false;
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
  graphics_context_set_stroke_color(ctx, WIND_MARK_COLOR);
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
  graphics_context_set_fill_color(ctx, PRECIP_BAR_COLOR);

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

  graphics_context_set_stroke_color(ctx, NIGHT_HATCH_COLOR);
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

  graphics_context_set_fill_color(ctx, NIGHT_FILL_COLOR);
  graphics_fill_rect(ctx, region, 0, GCornerNone);
  prv_draw_hatch_in_region(ctx, region);

  graphics_context_set_stroke_color(ctx, NIGHT_BORDER_COLOR);
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

static void prv_draw_y_axis_minor_ticks(GContext *ctx, int plot_left, int plot_top, int plot_h, int8_t min_temp,
                                        int8_t max_temp) {
  if (Y_MINOR_TICKS_PER_INTERVAL <= 0) {
    return;
  }

  graphics_context_set_stroke_color(ctx, CHART_TICK_COLOR);
  graphics_context_set_stroke_width(ctx, 1);

  for (int t = 0; t < Y_MAJOR_LABEL_INTERVALS; t++) {
    int8_t temp_upper = max_temp - (int8_t)(((max_temp - min_temp) * t) / Y_MAJOR_LABEL_INTERVALS);
    int8_t temp_lower = max_temp - (int8_t)(((max_temp - min_temp) * (t + 1)) / Y_MAJOR_LABEL_INTERVALS);

    for (int m = 1; m <= Y_MINOR_TICKS_PER_INTERVAL; m++) {
      int8_t temp =
          temp_upper - (int8_t)(((temp_upper - temp_lower) * m) / (Y_MINOR_TICKS_PER_INTERVAL + 1));
      int y = prv_plot_y(plot_top, plot_h, temp, min_temp, max_temp);
      graphics_draw_line(ctx, GPoint(plot_left - Y_MINOR_TICK_LENGTH, y), GPoint(plot_left, y));
    }
  }
}

static void prv_draw_y_axis_ticks(GContext *ctx, GFont font, int plot_left, int plot_top, int plot_h, int8_t min_temp,
                                  int8_t max_temp) {
  static char label[8];

  prv_draw_y_axis_minor_ticks(ctx, plot_left, plot_top, plot_h, min_temp, max_temp);

  graphics_context_set_stroke_width(ctx, Y_MAJOR_TICK_THICKNESS);

  for (int t = 0; t <= Y_MAJOR_LABEL_INTERVALS; t++) {
    int8_t temp = max_temp - (int8_t)(((max_temp - min_temp) * t) / Y_MAJOR_LABEL_INTERVALS);
    int y = prv_plot_y(plot_top, plot_h, temp, min_temp, max_temp);

    graphics_context_set_stroke_color(ctx, CHART_TICK_COLOR);
    graphics_draw_line(ctx, GPoint(plot_left - Y_MAJOR_TICK_LENGTH, y), GPoint(plot_left, y));

    prv_format_temp_label(label, sizeof(label), temp);
    graphics_context_set_text_color(ctx, CHART_LABEL_COLOR);
    graphics_draw_text(ctx, label, font,
                       GRect(CHART_MARGIN_H, y - Y_LABEL_HEIGHT / 2 + Y_LABEL_Y_OFFSET, Y_LABEL_WIDTH, Y_LABEL_HEIGHT),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
  }
}

static void prv_draw_x_axis_minor_ticks(GContext *ctx, const WeatherData *data, int plot_left, int plot_w, int axis_y) {
  if (X_MINOR_TICKS_PER_INTERVAL <= 0) {
    return;
  }

  graphics_context_set_stroke_color(ctx, CHART_TICK_COLOR);
  graphics_context_set_stroke_width(ctx, 1);

  for (int hour = 0; hour < (int)data->hour_count; hour++) {
    if (!prv_is_x_minor_tick_index(data, hour)) {
      continue;
    }

    int x = prv_plot_x(plot_left, plot_w, hour, data->hour_count);
    graphics_draw_line(ctx, GPoint(x, axis_y), GPoint(x, axis_y + X_MINOR_TICK_LENGTH));
  }
}

static void prv_draw_x_axis(GContext *ctx, const WeatherData *data, GFont font, int plot_left, int plot_w, int axis_y,
                            int max_label_right) {
  static char label[8];
  static const int label_w = 14;

  prv_draw_x_axis_minor_ticks(ctx, data, plot_left, plot_w, axis_y);

  graphics_context_set_stroke_width(ctx, X_MAJOR_TICK_THICKNESS);

  for (int hour = 0; hour < (int)data->hour_count; hour++) {
    if (!prv_is_x_major_tick_index(data, hour)) {
      continue;
    }

    time_t when = prv_forecast_time_for_index(data, hour);
    int x = prv_plot_x(plot_left, plot_w, hour, data->hour_count);

    graphics_context_set_stroke_color(ctx, CHART_TICK_COLOR);
    graphics_draw_line(ctx, GPoint(x, axis_y), GPoint(x, axis_y + X_MAJOR_TICK_LENGTH));

    if (prv_is_x_label_index(data, hour)) {
      prv_format_time_label(label, sizeof(label), when);
      graphics_context_set_text_color(ctx, CHART_LABEL_COLOR);
      GRect label_rect = GRect(x - label_w / 2,
                                axis_y + X_MAJOR_TICK_LENGTH + X_TICK_TO_LABEL_GAP + X_LABEL_Y_OFFSET, label_w,
                                X_LABEL_HEIGHT);
      if (label_rect.origin.x + label_rect.size.w > max_label_right) {
        label_rect.origin.x = max_label_right - label_rect.size.w;
      }
      graphics_draw_text(ctx, label, font, label_rect, GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    }
  }
}

static void prv_plot_layer_update_proc(Layer *layer, GContext *ctx) {
  WeatherChart *chart = s_weather_chart;
  if (!chart || layer != chart->plot_layer) {
    return;
  }

  WeatherData *data = weather_get();
  if (data->state == WEATHER_STATE_LOADING || data->state == WEATHER_STATE_ERROR ||
      data->state == WEATHER_STATE_UNAVAILABLE || data->hour_count == 0) {
    return;
  }

  GRect root_bounds = layer_get_bounds(chart->layer);
  ChartLayout layout;
  if (!prv_compute_layout(root_bounds, data, &layout)) {
    return;
  }

  GRect plot_bounds = layer_get_bounds(layer);
  int plot_left = 0;
  int plot_right = plot_bounds.size.w;
  int plot_top = PLOT_TOP_OVERFLOW;
  int plot_h = layout.plot_h;
  int axis_y = plot_top + plot_h;
  int plot_w = plot_bounds.size.w;

  chart->point_count = data->hour_count;
  prv_draw_precip_bars(ctx, data, plot_left, plot_right, plot_w, axis_y, plot_h, layout.precip_max);
  prv_draw_night_regions(ctx, data, plot_left, plot_right, plot_top, axis_y, plot_w);
  prv_draw_wind_marks(ctx, data, plot_left, plot_w, axis_y, plot_h, layout.wind_max);

  for (int i = 0; i < data->hour_count; i++) {
    int8_t temp = formatting_display_temp(data->temps[i]);
    chart->temp_points[i] = GPoint(prv_plot_x(plot_left, plot_w, i, data->hour_count),
                                   prv_plot_y(plot_top, plot_h, temp, layout.axis_min, layout.axis_max));
  }

  if (chart->point_count >= 2) {
    graphics_context_set_stroke_color(ctx, TEMP_LINE_COLOR);
    graphics_context_set_stroke_width(ctx, TEMP_LINE_STROKE_WIDTH);
    for (int i = 0; i < chart->point_count - 1; i++) {
      graphics_draw_line(ctx, chart->temp_points[i], chart->temp_points[i + 1]);
    }
  }

  graphics_context_set_fill_color(ctx, TEMP_POINT_COLOR);
  for (int i = 0; i < chart->point_count; i++) {
    graphics_fill_circle(ctx, chart->temp_points[i], TEMP_POINT_RADIUS);
  }
}

static void prv_decor_layer_update_proc(Layer *layer, GContext *ctx) {
  WeatherChart *chart = s_weather_chart;
  if (!chart || layer != chart->decor_layer) {
    return;
  }

  GRect bounds = layer_get_bounds(layer);
  WeatherData *data = weather_get();

  graphics_context_set_text_color(ctx, CHART_STATUS_TEXT_COLOR);
  if (data->state == WEATHER_STATE_LOADING) {
    graphics_draw_text(ctx, "Loading weather...", fonts_get_system_font(FONT_KEY_GOTHIC_18), bounds,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  if (data->state == WEATHER_STATE_UNAVAILABLE) {
    graphics_draw_text(ctx, "Weather unavailable", fonts_get_system_font(FONT_KEY_GOTHIC_18), bounds,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  if (data->state == WEATHER_STATE_ERROR || data->hour_count == 0) {
    graphics_draw_text(ctx, "No weather data", fonts_get_system_font(FONT_KEY_GOTHIC_18), bounds,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  ChartLayout layout;
  if (!prv_compute_layout(bounds, data, &layout)) {
    return;
  }
  prv_sync_plot_layer_frame(chart, bounds);

  GFont axis_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);

  prv_draw_y_axis_ticks(ctx, axis_font, layout.plot_left, layout.plot_top, layout.plot_h, layout.axis_min,
                        layout.axis_max);
  prv_draw_x_axis(ctx, data, axis_font, layout.plot_left, layout.plot_w, layout.axis_y,
                  bounds.size.w - CHART_MARGIN_RIGHT);

  graphics_context_set_stroke_color(ctx, CHART_AXIS_COLOR);
  graphics_context_set_stroke_width(ctx, 1);
  graphics_draw_line(ctx, GPoint(layout.plot_left, layout.plot_top), GPoint(layout.plot_left, layout.axis_y));
  graphics_draw_line(ctx, GPoint(layout.plot_left, layout.axis_y), GPoint(layout.plot_right, layout.axis_y));
}

WeatherChart *weather_chart_create(Layer *parent) {
  WeatherChart *chart = malloc(sizeof(WeatherChart));
  if (!chart) {
    return NULL;
  }

  GRect bounds = layer_get_bounds(parent);
  chart->layer = layer_create(
      GRect(0, bounds.size.h - WEATHER_CHART_HEIGHT - Y_LABEL_HEADROOM, bounds.size.w,
            WEATHER_CHART_HEIGHT + Y_LABEL_HEADROOM));

  chart->plot_layer = layer_create(GRect(0, 0, 1, 1));
  layer_set_clips(chart->plot_layer, true);
  layer_set_update_proc(chart->plot_layer, prv_plot_layer_update_proc);
  layer_add_child(chart->layer, chart->plot_layer);

  chart->decor_layer = layer_create(GRect(0, 0, bounds.size.w, WEATHER_CHART_HEIGHT + Y_LABEL_HEADROOM));
  layer_set_update_proc(chart->decor_layer, prv_decor_layer_update_proc);
  layer_add_child(chart->layer, chart->decor_layer);

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
  layer_set_frame(chart->layer,
                  GRect(frame.origin.x, frame.origin.y - Y_LABEL_HEADROOM, frame.size.w,
                        frame.size.h + Y_LABEL_HEADROOM));
  layer_set_frame(chart->decor_layer, GRect(0, 0, frame.size.w, frame.size.h + Y_LABEL_HEADROOM));
  prv_sync_plot_layer_frame(chart, layer_get_bounds(chart->decor_layer));
}

void weather_chart_refresh(WeatherChart *chart) {
  if (!chart) {
    return;
  }
  layer_mark_dirty(chart->plot_layer);
  layer_mark_dirty(chart->decor_layer);
}
