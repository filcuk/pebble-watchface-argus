#pragma once

#include <pebble.h>

int8_t formatting_display_temp(int8_t celsius);
bool formatting_use_24h(void);
void formatting_clock_hour_label(char *buf, size_t len, struct tm *tm);
void formatting_format_grouped_int(char *buf, size_t len, int value);
