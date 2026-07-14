# Agent notes — Argus watchface

## AppMessage (watch ↔ phone)

`require('message_keys')` maps `package.json` `messageKeys` names to **numeric** ids used when **sending** phone→watch (`Pebble.sendAppMessage({ [keys.Foo]: value })`).

**When receiving** watch→phone AppMessages on rePebble, `e.payload` often uses the **string** names from `package.json` (e.g. `"REQUEST_WEATHER": 1`), not the numeric ids. Reading only `e.payload[keys.REQUEST_WEATHER]` then returns `undefined`, the handler no-ops, and the watch times out while `outbox_send` still reports success.

Always read inbound payloads via `appMessagePayloadGet` / `appMessagePayloadHas` in `src/pkjs/index.js` (numeric id, string name, and stringified id). Do **not** use `e.payload[keys.SomeKey]` alone for watch→phone traffic.

`WeatherRequestKind` periodic is `0` — use `appMessagePayloadHas` / explicit undefined checks, not truthiness on the kind value.

## Settings menu (Clay / PKJS)

The phone settings UI is **not** a hosted web app. Clay embeds HTML, CSS, and JavaScript as a **data URI** opened in the rePebble app WebView via `Pebble.openURL()`. It works offline.

### Key files

| File | Role |
|------|------|
| `src/pkjs/config.js` | Clay config — built-in components only (`radiogroup`, `toggle`, `input`, `submit`, `text`); static help HTML (precip/wind tables, extended descriptions) |
| `src/pkjs/clay/theme.css` | Settings theme (scoped under `html.as`) |
| `src/pkjs/clay/parts/*.js` | Custom Clay logic — tabs, layout, holiday UI, sync (edit these) |
| `src/pkjs/custom-clay.js` | **Generated** by `scripts/build-custom-clay.js` — do not edit by hand |
| `src/pkjs/index.js` | Clay init, settings sync to watch, weather PKJS, AppMessage receive |

Do **not** reintroduce custom Clay components under `clay-components/` unless you can verify they serialize and render reliably on a real phone. Prefer built-ins + `src/pkjs/clay/`.

**Do not use `require()` inside the generated custom Clay function.** Clay embeds it in a data-URI WebView via `toSource()`, so webpack `require` is unavailable there and tab injection will fail silently. Pass minimal data through `userData` in `index.js` (version, URLs only). Holiday country/region lists are loaded at runtime in the settings WebView from Nager.Date (cached in `localStorage`) to keep the Clay URL small.

### Clay URL budget

The entire settings page is one `data:` URI passed to `Pebble.openURL()`. Size matters.

- Measure: `npm run measure-clay` (uses `scripts/measure-clay-url.js`, fails above **180 KB** by default)
- Regenerate: `pebble build` runs `scripts/build-custom-clay.js` via `wscript` (or `npm run build:clay` alone)
- As of the modular refactor: total ~**158 KB** (customFn ~**44 KB**, config JSON ~**13 KB**, Clay base ~**114 KB**)
- Keep static prose/HTML in `config.js`; keep logic in `clay/parts/`; CSS in `clay/theme.css`

### Clay source modules (`src/pkjs/clay/parts/`)

| File | Role |
|------|------|
| `01-holiday.js` | Nager.Date fetch/cache, subdivision catalog, locale country detection |
| `02-layout.js` | Key arrays, tabs, footer, row styles, tab panels, `showTab` |
| `03-sync.js` | Debug/location/holiday visibility, select dropdowns, segment sync |
| `05-theme.js` | `injectTheme()` |
| `06-after-build.js` | `AFTER_BUILD` handler wiring |

### What is supported

- Built-in Clay components and standard DOM APIs in the phone WebView
- Custom JavaScript via generated `custom-clay.js` (`AFTER_BUILD`, DOM injection, event listeners)
- Injected CSS via a `<style id="argus-theme">` tag (scoped under `html.as`; `html.argus-settings` class also set on `<html>`)
- `localStorage` persistence (`clay-settings`) on the phone
- AppMessage delivery to the watch on save

### What is unreliable or unsupported

- **CSS Grid** and **`display: contents`** — may work in the emulator but fail or layout incorrectly on older phone WebViews. Use **flexbox** and explicit DOM wrappers (see `.argus-control-row` in `clay/parts/`).
- **Modern CSS** such as `gap`, `position: sticky`, and `env(safe-area-inset-*)` — use with care; test on device.
- **Blanket CSS selectors** — avoid rules like `html.argus-settings label { … }` because segment pills are `<label>` elements and will inherit unintended styles.
- **External assets** — no CDN URLs; everything must be inlined in the Clay bundle.
- **Native app chrome** — the rePebble wrapper (“App Settings”, back button) is outside our control.

### Clay default CSS conflicts

Clay ships strong base styles (see `@rebble/clay` `_base.scss`). Expect to override:

- Global `label` — `display: flex`, horizontal padding (~0.75rem)
- Global `button` — `min-width: 12rem`, `text-transform: uppercase`
- `.component` — vertical padding between items
- `.description` — horizontal padding

When overriding Clay, prefer:

1. Scope under `html.as` (or `html.argus-settings` on `<html>`)
2. Target specific classes (`.argus-segment-radiogroup .radio-group label`, not all `label`)
3. Use `!important` where Clay defaults still win on phone (padding, min-width, text-transform)

Inject theme CSS **last** in `AFTER_BUILD` so it wins the cascade. Remove any existing `#argus-theme` node before re-injecting.

### Layout conventions in this project

- **Tabs** — injected in `clay/parts/02-layout.js`; compact buttons, not Clay’s full-width uppercase buttons
- **One-line controls** (segments, toggles) — title on top; description + control in `.argus-control-row` (flex, top-aligned)
- **List radiogroups** (`HeaderDisplay`, `ClockFont`, `WeatherProvider`, `GpsMaxAge`, `WeatherUpdateInterval`) — full-width list; left-aligned text, radio circle on the right
- **Theme** — fixed dark gray palette; do not use `@media (prefers-color-scheme)` (causes phone/emulator mismatch)
- **Accent** — steel blue `#4a6885` for active states (chosen for white-text contrast)

### Settings defaults and storage

- C-side defaults live in `src/c/settings.c` (`settings_set_defaults()`).
- Clay `defaultValue` in `config.js` applies only when a key is **missing** from `localStorage`.
- Legacy `RealtimeSteps` boolean values in `localStorage` break radiogroup selection — normalize in `clay/parts/` and `index.js` when reading stored settings.

### Control type mapping

| UI pattern | Clay type | Keys / notes |
|------------|-----------|--------------|
| Segment pills | `radiogroup` + `.argus-segment-radiogroup` | `HourFormat`, `WeekStart`, `BluetoothDisplay`, `LocationMode`, `ForecastHours`, `TemperatureUnit`, `WeekNumberMode` (label: Calendar; ISO/US) |
| List radiogroup | `radiogroup` + `.argus-list-radiogroup` | `HeaderDisplay`, `ClockFont`, `RealtimeSteps`, `WeatherProvider`, `GpsMaxAge`, `WeatherUpdateInterval`, `HolidayRegion` (hidden when country has no subdivisions) |
| Holiday country dropdown | `input` in config + native `<select>` in `clay/parts/` | `HolidayCountry`; country list fetched from Nager.Date when settings open (cached in phone `localStorage`); region names from hidden `text` item `argus-holiday-subdivisions-data` (~2 KB), with API fallback for other countries |
| Weather help tables | `text` items in config (`argus-precipitation-info`, `argus-wind-info`) | Static HTML in `defaultValue`; `applyRowStyles()` adds layout classes only |
| Boolean toggle | `toggle` + `.argus-inline-control` | `TemperatureDisplay`, `PauseWeatherAtNight`, debug toggles |
| Text input | `input` | `ManualLocation` (hidden when Location is Auto; GPS frequency hidden when Manual) |

### Testing checklist

Always verify on a **real phone**, not only the Pebble emulator:

1. `pebble build`, reinstall `.pbw`
2. Open watchface settings from rePebble app
3. Check tab bar (not uppercase full-width Clay buttons)
4. Check segment pill padding and section header spacing
5. Check two-column description + control rows
6. Save settings and confirm watch behaviour

Emulator layout looking correct does **not** guarantee phone layout is correct.

### References

- [Rebble app configuration guide](https://developer.rebble.io/guides/user-interfaces/app-configuration/)
- [@rebble/clay](https://www.npmjs.com/package/@rebble/clay) — built-in components, `customFn`, `localStorage` behaviour
