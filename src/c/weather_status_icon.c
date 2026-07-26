#include "weather_status_icon.h"

/* Shared cloud silhouette + shading from custom icons weather/v2
 * (cloud-yellow / cloud-red / cloud-blue). 1 = light fill, 2 = dark fill. */
static const uint8_t s_cloud_data[WEATHER_STATUS_ICON_WIDTH * WEATHER_STATUS_ICON_HEIGHT] = {
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 3, 1, 1, 1, 1, 3, 0, 0, 0,
    0, 0, 3, 3, 3, 1, 2, 2, 2, 2, 3, 3, 0, 0,
    0, 3, 1, 1, 1, 3, 1, 2, 2, 2, 3, 1, 3, 0,
    0, 3, 1, 2, 2, 1, 2, 2, 2, 3, 1, 2, 3, 0,
    0, 3, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 3, 0,
    0, 3, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 0,
    0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
};

#define CLOUD_PX_EMPTY 0
#define CLOUD_PX_LIGHT 1
#define CLOUD_PX_DARK 2
#define CLOUD_PX_WHITE 3

WeatherStatusIconKind weather_status_icon_kind(void) {
  if (weather_use_demo_data()) {
    return WEATHER_STATUS_ICON_NONE;
  }

  /* Priority: blue (night pause) > red (critical) > yellow (stale). */
  if (weather_is_night_pause_active()) {
    return WEATHER_STATUS_ICON_BLUE;
  }

  switch (weather_get_freshness()) {
    case WEATHER_FRESHNESS_CRITICAL:
      return WEATHER_STATUS_ICON_RED;
    case WEATHER_FRESHNESS_STALE:
      return WEATHER_STATUS_ICON_YELLOW;
    case WEATHER_FRESHNESS_OK:
    default:
      return WEATHER_STATUS_ICON_NONE;
  }
}

/* Fill colors from weather/v2 Piskel exports (light / dark). */
static GColor prv_fill_color(WeatherStatusIconKind kind, bool light) {
  switch (kind) {
    case WEATHER_STATUS_ICON_YELLOW:
      return light ? GColorFromHEX(0xFFCA4F) : GColorFromHEX(0xFFB300);
    case WEATHER_STATUS_ICON_RED:
      return light ? GColorFromHEX(0xFF7676) : GColorFromHEX(0xFF0000);
    case WEATHER_STATUS_ICON_BLUE:
      return light ? GColorFromHEX(0x6F83D9) : GColorFromHEX(0x2049FF);
    case WEATHER_STATUS_ICON_NONE:
    default:
      return GColorWhite;
  }
}

void weather_status_icon_draw(GContext *ctx, int x, int y, WeatherStatusIconKind kind) {
  if (kind == WEATHER_STATUS_ICON_NONE) {
    return;
  }

  for (int row = 0; row < WEATHER_STATUS_ICON_HEIGHT; row++) {
    for (int col = 0; col < WEATHER_STATUS_ICON_WIDTH; col++) {
      uint8_t pixel = s_cloud_data[row * WEATHER_STATUS_ICON_WIDTH + col];
      if (pixel == CLOUD_PX_EMPTY) {
        continue;
      }

      if (pixel == CLOUD_PX_WHITE) {
        graphics_context_set_fill_color(ctx, GColorWhite);
      } else if (pixel == CLOUD_PX_LIGHT) {
        graphics_context_set_fill_color(ctx, prv_fill_color(kind, true));
      } else {
        graphics_context_set_fill_color(ctx, prv_fill_color(kind, false));
      }

      graphics_fill_rect(ctx, GRect(x + col, y + row, 1, 1), 0, GCornerNone);
    }
  }
}
