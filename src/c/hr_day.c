#include "hr_day.h"

#include "argus_time.h"

#include <string.h>

#define HR_DAY_PERSIST_VERSION 1
#define HR_BPM_MIN 30
#define HR_BPM_MAX 220
#define HR_BACKFILL_CHUNK_MINUTES 60

typedef struct {
  uint32_t version;
  time_t day_start;
  uint8_t max_bpm;
} HrDayData;

static HrDayData s_hr_day;
static time_t s_backfill_cursor;
static bool s_backfill_active;
static bool s_backfill_dirty;

static bool prv_valid_hr_bpm(uint8_t bpm) {
  return bpm >= HR_BPM_MIN && bpm <= HR_BPM_MAX;
}

static time_t prv_today_start(void) {
  return time_start_of_today();
}

static void prv_persist(void) {
  persist_write_data(HR_DAY_PERSIST_KEY, &s_hr_day, sizeof(s_hr_day));
}

static void prv_backfill_finish(void) {
  if (s_backfill_dirty) {
    prv_persist();
    s_backfill_dirty = false;
  }
  s_backfill_active = false;
}

static void prv_reset_for_today(void) {
  s_hr_day.version = HR_DAY_PERSIST_VERSION;
  s_hr_day.day_start = prv_today_start();
  s_hr_day.max_bpm = 0;
  prv_persist();
}

void hr_day_init(void) {
  time_t today = prv_today_start();
  s_backfill_active = false;
  s_backfill_cursor = today;

  if (persist_exists(HR_DAY_PERSIST_KEY) && persist_get_size(HR_DAY_PERSIST_KEY) == sizeof(HrDayData)) {
    persist_read_data(HR_DAY_PERSIST_KEY, &s_hr_day, sizeof(s_hr_day));
    if (s_hr_day.version != HR_DAY_PERSIST_VERSION || s_hr_day.day_start != today) {
      prv_reset_for_today();
    }
    return;
  }

  prv_reset_for_today();
}

uint8_t hr_day_max(void) {
  if (s_hr_day.day_start != prv_today_start()) {
    return 0;
  }
  return s_hr_day.max_bpm;
}

bool hr_day_record(uint8_t bpm) {
  if (!prv_valid_hr_bpm(bpm)) {
    return false;
  }

  time_t today = prv_today_start();
  if (s_hr_day.day_start != today) {
    s_hr_day.day_start = today;
    s_hr_day.max_bpm = 0;
  }

  if (bpm <= s_hr_day.max_bpm) {
    return false;
  }

  s_hr_day.version = HR_DAY_PERSIST_VERSION;
  s_hr_day.max_bpm = bpm;
  if (s_backfill_active) {
    s_backfill_dirty = true;
  } else {
    prv_persist();
  }
  return true;
}

void hr_day_on_day_change(void) {
  prv_reset_for_today();
  s_backfill_active = false;
  s_backfill_cursor = prv_today_start();
}

void hr_day_backfill_start(void) {
  s_backfill_cursor = prv_today_start();
  s_backfill_active = true;
  s_backfill_dirty = false;
}

void hr_day_backfill_cancel(void) {
  prv_backfill_finish();
}

#if defined(PBL_HEALTH)
bool hr_day_backfill_chunk(void) {
  if (!s_backfill_active) {
    return true;
  }

  time_t end = argus_time_now();
  if (s_backfill_cursor >= end) {
    prv_backfill_finish();
    return true;
  }

  HealthMinuteData records[HR_BACKFILL_CHUNK_MINUTES];
  time_t query_start = s_backfill_cursor;
  time_t query_end = s_backfill_cursor + (HR_BACKFILL_CHUNK_MINUTES * SECONDS_PER_MINUTE);
  if (query_end > end) {
    query_end = end;
  }

  uint32_t count = health_service_get_minute_history(records, HR_BACKFILL_CHUNK_MINUTES, &query_start, &query_end);
  if (count == 0) {
    s_backfill_cursor = query_end;
    if (s_backfill_cursor >= end) {
      prv_backfill_finish();
      return true;
    }
    return false;
  }

  for (uint32_t i = 0; i < count; i++) {
    if (records[i].is_invalid) {
      continue;
    }
    hr_day_record(records[i].heart_rate_bpm);
  }

  s_backfill_cursor = query_end;
  if (s_backfill_cursor >= end) {
    prv_backfill_finish();
    return true;
  }

  return false;
}
#else
bool hr_day_backfill_chunk(void) {
  return true;
}
#endif
