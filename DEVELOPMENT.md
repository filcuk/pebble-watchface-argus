# Development

## Setup

**Windows:** use WSL (Ubuntu 22.04 or 24.04). The SDK does not run on Windows natively. The emulator needs glibc ≥ 2.32 (`ldd --version`).

```bash
# WSL dependencies
sudo apt update
sudo apt install nodejs npm libsdl2-2.0-0 libglib2.0-0 libpixman-1-0 zlib1g libsndio7.0

# Pebble CLI (Python 3.10+ via uv)
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uv tool install pebble-tool
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
python3 scripts/patch-pebble-tool-browser.py

# SDK + project
pebble sdk install latest
cd /mnt/c/Users/fifak/Documents/GitHub/pebble-watchface-argus
pebble package install @rebble/clay
npm install   # dev deps for Clay build (terser, clean-css)
```

Too old for glibc? `wsl --install -d Ubuntu-24.04` from PowerShell, then repeat setup. Or use [CloudPebble](https://cloudpebble.repebble.com) / a physical watch.

## Build and install

```bash
pebble build
pebble install --emulator emery   # emulator
pebble logs --emulator emery
```

After PKJS or `release.toml` changes, reinstall the `.pbw`. If JS changes do not appear, run `pebble clean && pebble build`. A good build logs a `merge_js` step listing `src/pkjs/*.js`.

### Physical watch (CloudPebble)

1. [rePebble app](https://repebble.com/app) on phone → **Devices** → **⋯** → **Enable Dev Connect** → sign in with GitHub.
2. `pebble login` on the computer (same GitHub account).
3. `pebble build && pebble install --cloudpebble`
4. Logs: `pebble logs --cloudpebble`

## Emulator

```bash
pebble emu-battery --percent 30
pebble emu-bt-connection --connected no
pebble emu-app-config --emulator emery   # Clay settings in Firefox
pebble screenshot --no-open frame.png
```

Run only one `pebble install --emulator` at a time. Close the old emulator window before starting another.

### Reset emulator data (`pebble wipe`)

Clears local emulator state: PKJS `localStorage` (Clay settings, weather/geocode cache, `argus-release-seen`), timeline, and related app data. Does **not** remove your Pebble account.

```bash
pebble kill --force          # stop emulator first
pebble wipe
pebble install --emulator emery
```

`pebble wipe --everything` also logs out the Pebble account on this machine.

**Surgical reset** (Argus PKJS storage only, without wiping the whole emulator):

```bash
pebble kill --force
rm -f ~/.local/share/pebble-sdk/4.17/emery/localstorage/f8c3a2b1-4d5e-6f70-8a9b-0c1d2e3f4a5b.*
```

To re-test the release notification without wiping storage: Clay **Debug → Release notification → Always**.

### Clay settings

Requires the `browser.py` patch from setup. Open with `pebble emu-app-config --emulator emery`; **Save** sends settings to the watch.

If save opens a broken `$$RETURN_TO$$` URL, re-run `python3 scripts/patch-pebble-tool-browser.py`, restart the emulator, and try again (re-run after `pebble-tool` upgrades).

Clay config must use built-in types only (`radiogroup`, `toggle`, `input`, `submit`, `text`). Unsupported types (e.g. `select`) break the config page.

**Clay UI sources** — edit [`src/pkjs/clay/`](src/pkjs/clay/) (`theme.css`, `parts/*.js`), not [`src/pkjs/custom-clay.js`](src/pkjs/custom-clay.js) directly. `pebble build` runs `scripts/build-custom-clay.js` (via `wscript`) and regenerates `custom-clay.js`. To rebuild Clay only: `npm run build:clay`. Check URL size: `npm run measure-clay` (fails above 180 KB by default; override with `--max=200000`).

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Boot loop / install failed | `bash scripts/reset-emulator.sh` then rebuild and reinstall |
| Still boot-looping | `bash scripts/reset-emulator.sh --reset-flash` then reinstall |
| `GLIBC_2.32` / `GLIBC_2.33` not found | Upgrade WSL distro (see Setup) |

## Releases

Edit [`release.toml`](release.toml) (`version`, `message`) before each release. `pebble build` runs `scripts/generate-release.js` (via `wscript` `options()`) and writes `src/pkjs/release.js`, syncing `package.json`.

The update notice is shown via `Pebble.showSimpleNotificationOnPebble` on the phone. It is skipped when `argus-release-seen` in phone storage matches the release version (unless Debug → **Always**).

## Screenshots and store assets

**Timed capture** — emulator must already be running; do not pass `--emulator` to the script:

```bash
pebble build && pebble install --emulator emery   # terminal 1

# terminal 2 — script copies itself to /tmp when run from /mnt/c/... (WSL mount bug)
bash scripts/capture-screenshots.sh --simulate --duration 3h --interval 1m
bash scripts/capture-screenshots.sh --simulate -d 14d -i 1h --start "2026-07-06 09:00"
```

Simulated mode uses `CaptureTimeOffset` (debug mode is enabled automatically). On Emery/QEMU 10, `pebble emu-set-time` is ignored. Frames go to `captures/sim-*/frame-NNNN-*.png`.

**Store demo scenario** — optional: set **Release notification → Never** in Clay first (phone-side only).

```bash
bash scripts/capture-scenario.sh scenarios/store-demo.json
```

**Post-process:**

```bash
ffmpeg -i frame.png -vf "scale=600:684:flags=neighbor" frame-3x.png
ffmpeg -framerate 2 -i captures/sim-*/frame-%04d-*.png -loop 0 demo.gif
```

Duration formats: `3h`, `90m`, `14d`, `3600s`, or bare minutes. `--no-demo-weather` needs higher `--settle` / `--warmup` (defaults 15s). Edit `scenarios/*.json` to change phased settings.

## Project layout

```
src/c/           Watchface (C)
src/pkjs/        Phone JS (weather, Clay, release notice)
scripts/         Emulator reset, capture helpers
release.toml     Release version + update message
package.json     Manifest and message keys
wscript          Build config
```

Clay UI conventions and phone testing checklist: [AGENTS.md](AGENTS.md).
