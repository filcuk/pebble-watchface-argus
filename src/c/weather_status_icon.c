#include "weather_status_icon.h"

/* Shared cloud silhouette from custom icons (cloud-orange/red/purple). */
static const uint32_t s_cloud_data[WEATHER_STATUS_ICON_WIDTH * WEATHER_STATUS_ICON_HEIGHT] = {
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0xffffffff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000,
    0x00000000, 0xffffffff, 0xff155fff, 0xff155fff, 0xff155fff, 0xffffffff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xffffffff, 0xff155fff, 0xffffffff, 0x00000000,
    0x00000000, 0xffffffff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xffffffff, 0xff155fff, 0xff155fff, 0xffffffff, 0x00000000,
    0x00000000, 0xffffffff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xffffffff, 0x00000000,
    0x00000000, 0xffffffff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xff155fff, 0xffffffff, 0x00000000,
    0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
};

WeatherStatusIconKind weather_status_icon_kind(void) {
  if (weather_use_demo_data()) {
    return WEATHER_STATUS_ICON_NONE;
  }

  /* Priority: purple (night pause) > red (critical) > orange (stale). */
  if (weather_is_night_pause_active()) {
    return WEATHER_STATUS_ICON_PURPLE;
  }

  switch (weather_get_freshness()) {
    case WEATHER_FRESHNESS_CRITICAL:
      return WEATHER_STATUS_ICON_RED;
    case WEATHER_FRESHNESS_STALE:
      return WEATHER_STATUS_ICON_ORANGE;
    case WEATHER_FRESHNESS_OK:
    default:
      return WEATHER_STATUS_ICON_NONE;
  }
}

static GColor prv_fill_color(WeatherStatusIconKind kind) {
  switch (kind) {
    case WEATHER_STATUS_ICON_ORANGE:
      return GColorOrange;
    case WEATHER_STATUS_ICON_RED:
      return GColorRed;
    case WEATHER_STATUS_ICON_PURPLE:
      return GColorPurple;
    case WEATHER_STATUS_ICON_NONE:
    default:
      return GColorWhite;
  }
}

void weather_status_icon_draw(GContext *ctx, int x, int y, WeatherStatusIconKind kind) {
  if (kind == WEATHER_STATUS_ICON_NONE) {
    return;
  }

  GColor fill = prv_fill_color(kind);
  for (int row = 0; row < WEATHER_STATUS_ICON_HEIGHT; row++) {
    for (int col = 0; col < WEATHER_STATUS_ICON_WIDTH; col++) {
      uint32_t pixel = s_cloud_data[row * WEATHER_STATUS_ICON_WIDTH + col];
      if (pixel == 0) {
        continue;
      }

      if (pixel == 0xffffffff) {
        graphics_context_set_fill_color(ctx, GColorWhite);
      } else {
        graphics_context_set_fill_color(ctx, fill);
      }

      graphics_fill_rect(ctx, GRect(x + col, y + row, 1, 1), 0, GCornerNone);
    }
  }
}
