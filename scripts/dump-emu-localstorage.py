#!/usr/bin/env python3
"""Dump Argus keys from the Emery emulator PKJS localStorage."""
from __future__ import annotations

import json
import re
import time
from datetime import datetime
from pathlib import Path

UUID = "7b435c75-5965-4f3f-8c1c-206acf20ca7f"
BASE = Path.home() / ".local/share/pebble-sdk/4.17/emery/localstorage" / UUID


def main() -> None:
    dat = BASE.with_suffix(".dat").read_bytes()
    dir_text = BASE.with_suffix(".dir").read_text()
    entries = {}
    for line in dir_text.splitlines():
        m = re.match(r"'([^']+)',\s*\((\d+),\s*(\d+)\)", line)
        if m:
            entries[m.group(1)] = (int(m.group(2)), int(m.group(3)))

    def load(key: str):
        off, length = entries[key]
        return json.loads(dat[off : off + length].decode("utf-8"))

    print("keys:", ", ".join(sorted(entries)))
    print()

    settings = load("clay-settings")
    print("=== clay-settings (weather-related) ===")
    for k in [
        "PauseWeatherAtNight",
        "WeatherUpdateInterval",
        "LocationMode",
        "ManualLocation",
        "WeatherProvider",
        "DebugMode",
        "DemoWeather",
        "GpsMaxAge",
    ]:
        print(f"  {k}: {settings.get(k)}")
    print()

    cache = load("weather-fetch-cache")
    api = cache.get("apiFetchedAt") or cache.get("fetchedAt")
    age_m = (time.time() * 1000 - api) / 60000 if api else None
    print("=== weather-fetch-cache ===")
    print(
        {
            k: cache.get(k)
            for k in ["key", "apiFetchedAt", "fetchedAt", "count", "fetchTime", "latQ", "lonQ"]
        }
    )
    if age_m is not None:
        print(f"age_minutes≈{age_m:.1f}")
    print()

    if "argus-last-gps-fix" in entries:
        print("=== argus-last-gps-fix ===")
        print(load("argus-last-gps-fix"))
        print()

    off, length = entries["argus-weather-debug-log"]
    raw = dat[off : off + length].decode("utf-8", errors="replace")
    try:
        log = json.loads(raw)
    except json.JSONDecodeError as err:
        print(f"=== weather debug log JSON corrupt: {err} ===")
        print(f"raw length {len(raw)}; attempting recovery")
        log = None
        chunk = raw[raw.find("[") :]
        for end in range(len(chunk), 0, -1):
            try:
                log = json.loads(chunk[:end])
                print(f"recovered {len(log)} entries (truncated at {end}/{len(chunk)})")
                break
            except json.JSONDecodeError:
                continue
        if log is None:
            print(raw[:500])
            print("...")
            print(raw[-300:])
            return

    print(f"=== weather debug log ({len(log)} entries, last 40) ===")
    for e in log[-40:]:
        t = datetime.fromtimestamp(e["t"] / 1000).strftime("%Y-%m-%d %H:%M:%S")
        print(f"{t} {e.get('tag', '')} {e.get('msg', '')}")

    kinds = {}
    for e in log:
        if e.get("tag") == "REQ":
            msg = (e.get("msg") or "").split()[0] if e.get("msg") else "?"
            kinds[msg] = kinds.get(msg, 0) + 1
    print()
    print("REQ kind counts:", kinds)


if __name__ == "__main__":
    main()
