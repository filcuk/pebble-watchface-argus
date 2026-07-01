#pragma once

#include <pebble.h>

#define HEADER_HEIGHT 22

typedef struct Header Header;

Header *header_create(Layer *parent);
void header_destroy(Header *header);
void header_update(Header *header, struct tm *now);
void header_set_bounds(Header *header, GRect frame);
void header_refresh_bt(Header *header, bool connected);
void header_refresh_battery(Header *header, BatteryChargeState state);
