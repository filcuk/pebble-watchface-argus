#include "argus_time.h"

static int32_t s_time_offset;

time_t argus_time_now(void) {
  return time(NULL) + (time_t)s_time_offset;
}

int32_t argus_time_get_offset(void) {
  return s_time_offset;
}

void argus_time_set_offset(int32_t offset) {
  s_time_offset = offset;
}
