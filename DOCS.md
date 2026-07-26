# Argus — design notes

Living reference for non-obvious mechanisms. When changing these, update this file.

## Weather update flow

Weather refreshes are age- and coverage-aware. Force (bypass phone GPS/API caches) is reserved for:

- One-shot **Weather force update** (clears itself after save)
- Real changes to fetch inputs: `LocationMode`, `ManualLocation`, `ForecastHours`, `WeatherProvider`
- **Night pause end**: first minute after the pause window ends while Pause at night is enabled (`weather_on_minute` → `weather_request_force`), regardless of the configured update interval

Boot, BT reconnect, retries, and periodic ticks use coverage/age checks instead of force. At night, the phone does not re-send the same cache payload to the watch if it was already delivered successfully.

### Night pause and chart night bands

**Pause at night** (toggle) can run in two modes (`PauseWeatherMode`):

| Mode | When periodic refresh pauses | Pause-end force |
|------|------------------------------|-----------------|
| **Automatic** (`0`, default) | Outside sunrise→sunset (same as chart night) | First minute after sunrise |
| **Manual** (`1`) | Local wall-clock window `[PauseWeatherStartMin, PauseWeatherEndMin)` in 30-minute steps | First minute after `End` |

Manual window rules (minutes from midnight):

- Midnight-crossing (e.g. 22:00–06:00, start > end): paused when `now >= start OR now < end`
- Same-day (e.g. 01:00–05:00, start < end): paused when `now >= start AND now < end`
- `start == end`: treat as not paused
- Defaults: 20:00–06:00 (`1200` / `360`)

**Chart night bands** always use sun times — visual night ≠ Manual pause schedule.

Automatic night definition (Open-Meteo daily **sunrise/sunset** epochs as `WeatherSunriseEpochs` / `WeatherSunsetEpochs`):

- Pause / is-night: `weather_is_night_at` / phone `weatherIsNightNow` — night when `now` is outside every `[sunrise[i], sunset[i])`
- Chart chamfer: hatch edges at those exact times (X interpolated between hour samples)
- Fallback when sun times are missing: hourly `is_day`, then local 20:00–06:00

```mermaid
flowchart TD
  trigger[Trigger] --> kind{What happened?}
  kind -->|One-shot force fetch settings changed or pause window end| force[forceRefresh true]
  kind -->|Boot BT tick retry| smart[Age and coverage check]
  kind -->|Night pause non-force| night{Same cache already sent?}
  smart -->|Has covering data and not due| noop[No request]
  smart -->|Missing coverage| stale[REQ stale no force]
  smart -->|Age due| periodic[REQ periodic]
  night -->|Yes| skipNight[Skip send]
  night -->|No| sendCache[Send phone cache once]
  force --> api[Bypass GPS and API cache]
```

### Request kinds (watch → phone)

| Kind | Name | Phone behaviour |
|------|------|-----------------|
| `0` | periodic | Respect GPS + phone weather cache |
| `1` | force | Bypass caches; hit network |
| `2` | stale | Coverage gap; may reuse phone caches |

### Key code

| Area | Location |
|------|----------|
| Watch age/coverage helper | `weather_request_if_needed()` in `src/c/weather.c` |
| Pause window / pause-end force | `weather_on_minute()` in `src/c/weather.c` (from `prv_tick_handler`) |
| Phone force / night / sent marker | `src/pkjs/index.js` |
| One-shot force toggle | Clay `WeatherForceUpdate` (PKJS-only) |
