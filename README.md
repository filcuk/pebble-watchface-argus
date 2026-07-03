# Argus

rePebble watch face for Pebble Time 2 (Emery) with a calendar-focused layout: two-week date grid, centered time, and an hourly weather chart.

## Features

- **Header**: week number (ISO or Gregorian), month/year, Bluetooth status, battery level
- **Calendar**: current and next week with Monday or Saturday week start; today highlighted
- **Time**: 12h/24h (system override or forced format)
- **Weather**: Open-Meteo hourly temperature line and precipitation bars (24/48/72h)
- **Settings**: Clay configuration page on the phone

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
package.json     App manifest and message keys
wscript          Build configuration
```

## License

MIT — see [LICENSE](LICENSE).
