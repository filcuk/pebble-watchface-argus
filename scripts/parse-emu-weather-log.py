#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import Counter
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

    off, length = entries["argus-weather-debug-log"]
    raw = dat[off : off + length].decode("utf-8", errors="replace")
    print(f"dir length={length} decoded={len(raw)} trailing_file={len(dat) - off}")

    objs = re.findall(r'\{"t":\d+,"tag":"[^"]+","msg":"[^"]*"\}', raw)
    print(f"complete objects={len(objs)}")
    parsed = [json.loads(o) for o in objs]

    tags = Counter(e["tag"] for e in parsed)
    reqs = Counter((e.get("msg") or "?").split()[0] for e in parsed if e["tag"] == "REQ")
    skips = Counter(e.get("msg") or "?" for e in parsed if e["tag"] == "SKIP")
    print("tags:", dict(tags))
    print("REQ:", dict(reqs))
    print("SKIP:", dict(skips))
    if parsed:
        print("first:", datetime.fromtimestamp(parsed[0]["t"] / 1000), parsed[0])
        print("last:", datetime.fromtimestamp(parsed[-1]["t"] / 1000), parsed[-1])
        print("--- last 20 ---")
        for e in parsed[-20:]:
            t = datetime.fromtimestamp(e["t"] / 1000).strftime("%Y-%m-%d %H:%M:%S")
            print(t, e["tag"], e.get("msg"))


if __name__ == "__main__":
    main()
