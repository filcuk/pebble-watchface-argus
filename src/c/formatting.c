#include "formatting.h"

#include "settings.h"

#include <stdio.h>

int8_t formatting_display_temp(int8_t celsius) {
  const ArgusSettings *settings = settings_get();
  if (!settings->temperature_fahrenheit) {
    return celsius;
  }
  return (int8_t)(((celsius * 9) + (celsius >= 0 ? 2 : -2)) / 5 + 32);
}

bool formatting_use_24h(void) {
  const ArgusSettings *settings = settings_get();
  switch (settings->hour_format) {
    case HOUR_FORMAT_24H:
      return true;
    case HOUR_FORMAT_12H:
      return false;
    default:
      return clock_is_24h_style();
  }
}

void formatting_clock_hour_label(char *buf, size_t len, struct tm *tm) {
  if (!buf || len == 0) {
    return;
  }
  if (!tm) {
    buf[0] = '\0';
    return;
  }

  if (formatting_use_24h()) {
    snprintf(buf, len, "%d", tm->tm_hour);
  } else {
    int hour = tm->tm_hour % 12;
    if (hour == 0) {
      hour = 12;
    }
    snprintf(buf, len, "%d", hour);
  }
}
