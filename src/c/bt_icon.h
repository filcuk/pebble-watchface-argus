#pragma once

#include <pebble.h>

#define BT_ICON_WIDTH 14
#define BT_ICON_HEIGHT 14

void bt_icon_draw_connected(GContext *ctx, int x, int y);
void bt_icon_draw_lost(GContext *ctx, int x, int y);
