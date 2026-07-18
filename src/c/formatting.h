#pragma once

#include <pebble.h>

int8_t formatting_display_temp(int8_t celsius);
uint8_t formatting_display_wind(uint8_t kmh);
void formatting_wind_compass(char *buf, size_t len, uint16_t degrees);
bool formatting_use_24h(void);
void formatting_clock_hour_label(char *buf, size_t len, struct tm *tm);
void formatting_format_grouped_int(char *buf, size_t len, int value);
