#pragma once

#include <pebble.h>
#include <stdbool.h>
#include <stdint.h>

#define HR_DAY_PERSIST_KEY 4

void hr_day_init(void);
uint8_t hr_day_max(void);
bool hr_day_record(uint8_t bpm);
void hr_day_on_day_change(void);

void hr_day_backfill_start(void);
void hr_day_backfill_cancel(void);
bool hr_day_backfill_chunk(void);
