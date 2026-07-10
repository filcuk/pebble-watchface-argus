# Agent notes — Argus watchface

## Settings menu (Clay / PKJS)

The phone settings UI is **not** a hosted web app. Clay embeds HTML, CSS, and JavaScript as a **data URI** opened in the rePebble app WebView via `Pebble.openURL()`. It works offline.

### Key files

| File | Role |
|------|------|
| `src/pkjs/config.js` | Clay config — built-in components only (`radiogroup`, `toggle`, `input`, `submit`, `text`) |
| `src/pkjs/custom-clay.js` | Theme CSS, tabs, layout wrappers, conditional logic, defaults |
| `src/pkjs/index.js` | Clay init, settings sync to watch, weather PKJS |

Do **not** reintroduce custom Clay components under `clay-components/` unless you can verify they serialize and render reliably on a real phone. Prefer built-ins + `custom-clay.js`.

### What is supported

- Built-in Clay components and standard DOM APIs in the phone WebView
- Custom JavaScript via `custom-clay.js` (`AFTER_BUILD`, DOM injection, event listeners)
- Injected CSS via a `<style id="argus-theme">` tag (scoped under `html.argus-settings`)
- `localStorage` persistence (`clay-settings`) on the phone
- AppMessage delivery to the watch on save

### What is unreliable or unsupported

- **CSS Grid** and **`display: contents`** — may work in the emulator but fail or layout incorrectly on older phone WebViews. Use **flexbox** and explicit DOM wrappers (see `.argus-control-row` in `custom-clay.js`).
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

1. Scope under `html.argus-settings`
2. Target specific classes (`.argus-segment-radiogroup .radio-group label`, not all `label`)
3. Use `!important` where Clay defaults still win on phone (padding, min-width, text-transform)

Inject theme CSS **last** in `AFTER_BUILD` so it wins the cascade. Remove any existing `#argus-theme` node before re-injecting.

### Layout conventions in this project

- **Tabs** — injected in `custom-clay.js`; compact buttons, not Clay’s full-width uppercase buttons
- **One-line controls** (segments, toggles) — title on top; description + control in `.argus-control-row` (flex, top-aligned)
- **List radiogroups** (`HeaderDisplay`, `ClockFont`) — full-width list; left-aligned text, radio circle on the right
- **Theme** — fixed dark gray palette; do not use `@media (prefers-color-scheme)` (causes phone/emulator mismatch)
- **Accent** — steel blue `#4a6885` for active states (chosen for white-text contrast)

### Settings defaults and storage

- C-side defaults live in `src/c/settings.c` (`settings_set_defaults()`).
- Clay `defaultValue` in `config.js` applies only when a key is **missing** from `localStorage`.
- Legacy `RealtimeSteps` boolean values in `localStorage` break radiogroup selection — normalize in `custom-clay.js` and `index.js` when reading stored settings.

### Control type mapping

| UI pattern | Clay type | Keys / notes |
|------------|-----------|--------------|
| Segment pills | `radiogroup` + `.argus-segment-radiogroup` | `HourFormat`, `WeekStart`, `WeekNumberMode`, `BluetoothDisplay`, `RealtimeSteps`, `LocationMode`, `ForecastHours`, `TemperatureUnit` |
| Toggle list | `radiogroup` + `.argus-list-radiogroup` | `HeaderDisplay`, `ClockFont` |
| Boolean toggle | `toggle` + `.argus-inline-control` | `TemperatureDisplay`, debug toggles |
| Text input | `input` | `ManualLocation` |

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
