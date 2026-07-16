# Argus — design notes

Living reference for non-obvious mechanisms. When changing these, update this file.

## Weather update flow

Weather refreshes are age- and coverage-aware. Force (bypass phone GPS/API caches) is reserved for:

- Debug one-shot **Weather force update** (clears itself after save)
- Real changes to fetch inputs: `LocationMode`, `ManualLocation`, `ForecastHours`, `WeatherProvider`

Boot, BT reconnect, retries, and periodic ticks use coverage/age checks instead of force. At night, the phone does not re-send the same cache payload to the watch if it was already delivered successfully.

```mermaid
flowchart TD
  trigger[Trigger] --> kind{What happened?}
  kind -->|Debug one-shot or fetch settings changed| force[forceRefresh true]
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
| Phone force / night / sent marker | `src/pkjs/index.js` |
| Debug one-shot toggle | Clay `WeatherForceUpdate` (PKJS-only) |
