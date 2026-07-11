# Development

## Environment setup

**Windows:** use WSL (Ubuntu **22.04 or 24.04**). The SDK does not run natively on Windows. The emulator (`qemu-pebble`) needs glibc ≥ 2.32 — Ubuntu 20.04 will not work.

```bash
# 1. WSL dependencies
sudo apt update
sudo apt install nodejs npm libsdl2-2.0-0 libglib2.0-0 libpixman-1-0 zlib1g libsndio7.0

# 2. Pebble CLI (requires Python 3.10+; uv provides it)
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uv tool install pebble-tool
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
python3 scripts/patch-pebble-tool-browser.py

# 3. SDK + project deps
pebble sdk install latest
cd /mnt/c/Users/fifak/Documents/GitHub/pebble-watchface-argus
pebble package install @rebble/clay
```

## Build and run

```bash
pebble build
pebble install --emulator emery
pebble logs --emulator emery
```

## Install on a physical watch (CloudPebble)

One-time setup:

1. Install the [rePebble app](https://repebble.com/app) on your phone.
2. In the app: **Devices** → **⋯** → **Enable Dev Connect**, then sign in with GitHub.
3. On your computer: `pebble login` (same GitHub account).

Then build and send to the watch over the cloud relay (phone and computer do not need to be on the same Wi‑Fi):

```bash
pebble build
pebble install --cloudpebble
```

Logs from the watch: `pebble logs --cloudpebble`

Alternatively, open the project in the [CloudPebble IDE](https://cloudpebble.repebble.com) (GitHub import), compile in the browser, and install from there with Dev Connect enabled on the phone.

## Emulator testing

```bash
pebble emu-battery --percent 30
pebble emu-bt-connection --connected no
```

### Capturing screenshots

Use `scripts/capture-screenshots.sh` to grab emulator frames on a timer — useful for Rebble store assets (PNG or animated GIF) or timelapse demos.

1. Start the emulator with the watchface installed (terminal 1):

```bash
pebble install --emulator emery
```

2. Run the capture script (terminal 2, from the project root). The script auto-copies itself to `/tmp` when run from `/mnt/c/...` (avoids a WSL long-run bug on Windows mounts):

```bash
pebble build
pebble install --emulator emery

# Simulated: 3 hours of watch time (~180 frames, demo weather on by default)
bash scripts/capture-screenshots.sh --simulate --duration 3h --interval 1m

# Simulated: two-week calendar demo, one frame per hour
bash scripts/capture-screenshots.sh --simulate -d 14d -i 1h --start "2026-07-06 09:00"
```

**Simulated mode** shifts the watchface display time via `CaptureTimeOffset` app messages. Debug mode is enabled automatically (required for the offset). On Emery/QEMU 10, `pebble emu-set-time` is ignored — the script uses this in-app offset instead. Run `pebble build` and reinstall before simulated capture so the message key exists. Connect to an already-running emulator (do not pass `--emulator` to the script).

Frames are saved to `captures/run-.../` (real time) or `captures/sim-.../` (simulated) as `frame-NNNN-YYYYMMDD-HHMMSS.png`. Press **Ctrl+C** to stop early.

**Duration formats:** `3h`, `90m`, `14d`, `3600s`, or a bare number (minutes). Default interval is 60 seconds. Simulated mode accepts `--start "2026-07-06 09:00"` (default is Monday 09:00), `--warmup 8` (wait before first frame), and `--settle 1.5` (pause after each time jump).

With `--no-demo-weather`, each simulated time jump refetches live forecast data — use at least `--settle 15` (default) and `--warmup 15`. The script retries screenshots up to 3 times if the emulator is busy.

Single screenshots without the script:

```bash
pebble screenshot --no-open argus-default.png
```

Upscale for store listings (this SDK’s `pebble screenshot` has no `--scale` flag):

```bash
ffmpeg -i argus-default.png -vf "scale=600:684:flags=neighbor" argus-default-3x.png
```

Stitch captured frames into an animated GIF:

```bash
ffmpeg -framerate 1 -i captures/sim-*/frame-%04d-*.png -loop 0 argus-timelapse.gif
```

**Demo weather** is enabled automatically in simulated capture mode. For manual screenshots, enable it in Clay settings.

### Store demo animation (multi-phase scenario)

Use `scripts/capture-scenario.sh` to run a predefined capture that changes watch settings between simulated time segments — useful for a standard Rebble store animation after each update.

1. Build, install, and start the emulator (terminal 1):

```bash
pebble build
pebble install --emulator emery
```

2. Optional: open Clay once and set **Release notification** to **Never** (this setting is phone-side only and is not sent by the capture script).

3. Run the store demo (terminal 2):

```bash
bash scripts/capture-scenario.sh scenarios/store-demo.json
```

The bundled `scenarios/store-demo.json` captures **36 hourly frames** (6 phases × 6 hours) starting **2026-07-04 06:00**, with demo weather/biometrics, manual location **Prague**, and phases that cycle header modes (steps → HR → temperature), week start (Sunday), clock font (Bitham Bold), and °F scale.

The scenario runner applies the `setup` block once after boot wait. Each phase sends **only its changed settings**; the first screenshot in each phase sets the simulated time offset.

Frames land in `captures/sim-YYYYMMDD-HHMMSS/` (a new folder each run). Stitch into a GIF:

```bash
ffmpeg -framerate 2 -i captures/sim-*/frame-%04d-*.png -loop 0 argus-store-demo.gif
```

Edit `scenarios/store-demo.json` or add new scenario files to change the timeline. Scenario `setup` holds defaults applied before phase 1; each phase merges its `settings` cumulatively.

### Opening settings

Clay settings open in **Firefox** (via WSL). The one-time `browser.py` patch in [Environment setup](#environment-setup) must be applied first.

1. Start the emulator with the watchface installed:

```bash
pebble install --emulator emery
```

2. In a **second** WSL terminal (from the project root), open the Clay settings page:

```bash
pebble emu-app-config --emulator emery
```

Firefox should open the Argus settings UI. Change options and tap **Save** (or submit the form). Settings are sent back to the emulator over a local HTTP callback and applied on the watch.

If the settings page fails to open or save, see the troubleshooting sections below.

### Settings page fails in Firefox (`$$RETURN_TO$$` in the URL)

Clay settings in the emulator open in Firefox via a temporary HTML file. `pebble-tool` must substitute the Clay return URL before the page is served. If saving settings tries to open a nonsense path like `///wsl$/.../$$RETURN_TO$${...}`, re-run:

```bash
python3 scripts/patch-pebble-tool-browser.py
```

Then restart the emulator and open settings again. Re-run the patch after upgrading `pebble-tool`.

### Emulator boot loop or "app install failed"

This usually means several emulator instances are running at once (easy to do if install was interrupted). In WSL:

```bash
bash scripts/reset-emulator.sh
pebble build
pebble install --emulator emery
```

If it still boot-loops after that, reset the emulator's flash image (safe; only affects the local emulator):

```bash
bash scripts/reset-emulator.sh --reset-flash
pebble install --emulator emery
```

(`reset-emulator.sh` runs `pebble kill --force`.) Only run one `pebble install --emulator` at a time. Close the old emulator window before starting another.

### Emulator won't start (`GLIBC_2.32` / `GLIBC_2.33` not found)

Your WSL distro is too old. Check with `ldd --version` — you need glibc 2.32+.

**Fix:** install a newer WSL distro (from PowerShell):

```powershell
wsl --install -d Ubuntu-24.04
```

Then repeat the environment setup inside the new distro. Alternatively use [CloudPebble](https://cloudpebble.net) or install to a physical watch via `pebble install` with Dev Connect enabled in the rePebble app.

## Project layout

```
src/c/           Watch face (C)
src/pkjs/        Phone-side JS (weather + Clay settings)
scripts/         Helper scripts (emulator reset, screenshot capture)
package.json     App manifest and message keys
wscript          Build configuration
```

For Clay settings UI conventions and testing notes, see [AGENTS.md](AGENTS.md).
