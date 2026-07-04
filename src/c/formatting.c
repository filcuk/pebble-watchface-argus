#include "formatting.h"

#include "settings.h"

#include <stdio.h>
#include <string.h>

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

void formatting_format_grouped_int(char *buf, size_t len, int value) {
  if (!buf || len == 0) {
    return;
  }
  if (value < 0) {
    snprintf(buf, len, "%d", value);
    return;
  }

  char raw[12];
  snprintf(raw, sizeof(raw), "%d", value);
  size_t raw_len = strlen(raw);
  size_t spaces = raw_len > 0 ? (raw_len - 1) / 3 : 0;
  if (spaces + raw_len + 1 > len) {
    snprintf(buf, len, "%d", value);
    return;
  }

  size_t out = 0;
  size_t first_group = raw_len % 3;
  if (first_group == 0 && raw_len > 0) {
    first_group = 3;
  }

  for (size_t i = 0; i < raw_len;) {
    if (i > 0) {
      buf[out++] = ' ';
    }
    size_t group_len = (i == 0) ? first_group : 3;
    memcpy(buf + out, raw + i, group_len);
    out += group_len;
    i += group_len;
  }
  buf[out] = '\0';
}
