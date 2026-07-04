#pragma once

#include <pebble.h>

time_t argus_time_now(void);
int32_t argus_time_get_offset(void);
void argus_time_set_offset(int32_t offset);
