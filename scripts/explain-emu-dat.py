#!/usr/bin/env python3
"""Explain size of emulator localStorage .dat vs weather log."""
from __future__ import annotations

import json
import re
from pathlib import Path

# Prefer repo capture copy, then live emulator path.
CANDIDATES = [
    Path(__file__).resolve().parents[1] / "captures/emu-stuck-20260714",
    Path.home() / ".local/share/pebble-sdk/4.17/emery/localstorage",
]


def load_store(directory: Path):
    uuid = "7b435c75-5965-4f3f-8c1c-206acf20ca7f"
    dat = (directory / f"{uuid}.dat").read_bytes()
    dir_text = (directory / f"{uuid}.dir").read_text()
    entries = {}
    for line in dir_text.splitlines():
        m = re.match(r"'([^']+)',\s*\((\d+),\s*(\d+)\)", line)
        if m:
            entries[m.group(1)] = (int(m.group(2)), int(m.group(3)))
    return dat, entries


def main() -> None:
    directory = next(p for p in CANDIDATES if (p / "7b435c75-5965-4f3f-8c1c-206acf20ca7f.dat").exists())
    print(f"using {directory}")
    dat, entries = load_store(directory)
    print(f".dat size: {len(dat)} bytes")
    print()
    print(f"{'key':40} {'offset':>10} {'length':>8} {'end':>10}")
    covered = 0
    for key, (off, length) in sorted(entries.items(), key=lambda kv: kv[1][0]):
        print(f"{key:40} {off:10} {length:8} {off+length:10}")
        covered += length
    print()
    print(f"sum of .dir lengths: {covered}")
    print(f"unreferenced / slack in .dat: {len(dat) - covered}")

    off, length = entries["argus-weather-debug-log"]
    raw_bytes = dat[off : off + length]
    raw = raw_bytes.decode("utf-8", errors="replace")
    print()
    print(f"weather-debug-log length in .dir: {length}")
    print(f"weather-debug-log decoded chars: {len(raw)}")
    # Show where JSON breaks
    try:
        json.loads(raw)
        print("JSON: ok")
    except json.JSONDecodeError as e:
        print(f"JSON: corrupt at col {e.colno}: {e.msg}")
        print(f"  around break: {raw[max(0,e.pos-40):e.pos+40]!r}")
        # bytes after parsed content within slot
        print(f"  first 20 bytes of slot: {raw_bytes[:20]!r}")
        print(f"  last 40 bytes of slot: {raw_bytes[-40:]!r}")

    objs = re.findall(r'\{"t":\d+,"tag":"[^"]+","msg":"[^"]*"\}', raw)
    print(f"complete log objects in slot: {len(objs)} (LOG_MAX=85)")
    if objs:
        tags = {}
        for o in objs:
            tag = json.loads(o)["tag"]
            tags[tag] = tags.get(tag, 0) + 1
        print(f"tag mix: {tags}")


if __name__ == "__main__":
    main()
