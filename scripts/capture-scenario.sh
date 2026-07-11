#!/usr/bin/env bash
# Run a multi-phase simulated capture: apply settings between time-simulation segments.
#
# Usage:
#   pebble build && pebble install --emulator emery
#   bash scripts/capture-scenario.sh scenarios/store-demo.json
#
# Stitch frames into a GIF (optional):
#   ffmpeg -framerate 2 -i captures/sim-*/frame-%04d-*.png -loop 0 argus-store-demo.gif
set -eu

if [[ "${BASH_SOURCE[0]:-}" == /mnt/* ]] && [[ -z "${ARGUS_CAPTURE_REEXEC:-}" ]]; then
  export ARGUS_CAPTURE_REEXEC=1
  tmp=$(mktemp /tmp/argus-capture-scenario.XXXXXX.sh)
  cp "${BASH_SOURCE[0]}" "$tmp"
  chmod +x "$tmp"
  exec bash "$tmp" "$@"
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=capture-lib.sh
source "$SCRIPT_DIR/capture-lib.sh"

STOP=0
CLEANUP_DONE=0
START_EPOCH=0
SETTLE_DELAY=1.5
SETTINGS_SETTLE=3
BOOT_WAIT=8
WARMUP_SEC=5
OUTPUT_DIR=""
SCENARIO_FILE=""
OUTPUT_OVERRIDE=""
frame=0
failures=0

usage() {
  cat <<'EOF'
Run a scenario-driven simulated screenshot capture.

Usage:
  bash scripts/capture-scenario.sh SCENARIO.json [options]

Options:
  -o, --output DIR   Override output directory from the scenario file
  -h, --help         Show this help

Scenario JSON fields:
  start              Simulated start time (required)
  interval           Seconds between frames (default: 1h)
  settle             Pause after time/settings changes (default: 1.5)
  settings_settle    Extra pause after setup/phase settings (default: 3)
  boot_wait          Wait for PKJS to finish syncing defaults (default: 8)
  warmup             Wait before the first frame (default: 5)
  output             Optional output prefix (default: captures/sim-TIMESTAMP)
  setup              Settings applied once at start (message key names)
  phases[]           List of { label, duration, settings } — only changed keys per phase

Examples:
  pebble build && pebble install --emulator emery
  bash scripts/capture-scenario.sh scenarios/store-demo.json
EOF
}

on_interrupt() {
  if (( STOP )); then
    echo "Force quit."
    exit 130
  fi
  STOP=1
  echo ""
  echo "Stopping (Ctrl+C again to force quit)..."
}

cleanup() {
  if (( CLEANUP_DONE )); then
    return 0
  fi
  CLEANUP_DONE=1
  if (( STOP )); then
    echo "Skipping time reset (interrupted). Reinstall the watchface to restore real time."
  else
    reset_capture_offset
  fi
  echo ""
  echo "Stopped. Saved ${frame} frame(s) to ${OUTPUT_DIR}/"
  if (( failures > 0 )); then
    echo "Warning: ${failures} capture(s) failed" >&2
  fi
}

capture_phase_segment() {
  local phase_end="$1"
  local phase_label="$2"

  while (( !STOP && elapsed < phase_end )); do
    frame=$(( frame + 1 ))
    local sim_epoch=$(( START_EPOCH + elapsed ))
    local sim_label
    sim_label=$(date -d "@$sim_epoch" +%Y%m%d-%H%M%S)
    local filename
    filename=$(printf '%s/frame-%04d-%s.png' "$OUTPUT_DIR" "$frame" "$sim_label")

    if ! apply_capture_offset "$elapsed"; then
      failures=$(( failures + 1 ))
      printf '[frame %04d] CaptureTimeOffset FAILED (%s)\n' "$frame" "$(format_sim_time "$sim_epoch")" >&2
      if (( STOP )); then
        break
      fi
    else
      wait_for_settle
      if (( STOP )); then
        break
      fi
      if take_screenshot "$filename"; then
        printf '[frame %04d] %s (%s) -> %s\n' "$frame" "$(format_sim_time "$sim_epoch")" "$phase_label" "$(basename "$filename")"
      else
        failures=$(( failures + 1 ))
        printf '[frame %04d] screenshot FAILED (%s)\n' "$frame" "$(format_sim_time "$sim_epoch")" >&2
      fi
    fi

    if (( elapsed + INTERVAL_SEC >= phase_end )); then
      break
    fi
    if (( STOP )); then
      break
    fi
    elapsed=$(( elapsed + INTERVAL_SEC ))
  done
}

apply_scenario_settings() {
  local settings_file="$1"
  local label="$2"

  if ! send_settings_from_json "$settings_file" "$label"; then
    return 1
  fi

  # Display and unit keys are sent again individually (mixed batches and zero
  # values were not reliably updating the watch on the emulator).
  if ! send_reliable_named_settings "$settings_file"; then
    return 1
  fi

  sleep_interruptible "$SETTINGS_SETTLE"
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)
      OUTPUT_OVERRIDE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -n "$SCENARIO_FILE" ]]; then
        echo "Unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      SCENARIO_FILE="$1"
      shift
      ;;
  esac
done

if [[ -z "$SCENARIO_FILE" ]]; then
  echo "Error: scenario file is required" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$SCENARIO_FILE" ]]; then
  echo "Error: scenario file not found: $SCENARIO_FILE" >&2
  exit 1
fi

if ! command -v pebble >/dev/null 2>&1; then
  echo "Error: pebble CLI not found in PATH" >&2
  exit 1
fi

if [[ ! -f "$MSG_KEYS_FILE" ]]; then
  echo "Error: run 'pebble build' first (needed for message keys)" >&2
  exit 1
fi

WORK_DIR=$(mktemp -d /tmp/argus-scenario.XXXXXX)
trap 'rm -rf "$WORK_DIR"' EXIT

python3 - "$SCENARIO_FILE" "$WORK_DIR" <<'PY'
import json, sys

scenario_path, work_dir = sys.argv[1:3]
with open(scenario_path, encoding="utf-8") as f:
    scenario = json.load(f)

if "start" not in scenario:
    sys.exit("Scenario must include start")
if "phases" not in scenario or not scenario["phases"]:
    sys.exit("Scenario must include at least one phase")

meta = {
    "start": scenario["start"],
    "interval": scenario.get("interval", "1h"),
    "settle": scenario.get("settle", 1.5),
    "settings_settle": scenario.get("settings_settle", 3),
    "boot_wait": scenario.get("boot_wait", 8),
    "warmup": scenario.get("warmup", 5),
    "output": scenario.get("output", ""),
}
with open(f"{work_dir}/meta.json", "w", encoding="utf-8") as f:
    json.dump(meta, f)

setup = scenario.get("setup", {})
with open(f"{work_dir}/setup.json", "w", encoding="utf-8") as f:
    json.dump(setup, f)

for index, phase in enumerate(scenario["phases"], start=1):
    delta = phase.get("settings", {})
    with open(f"{work_dir}/phase-{index:02d}-delta.json", "w", encoding="utf-8") as f:
        json.dump(delta, f)
    with open(f"{work_dir}/phase-{index:02d}.json", "w", encoding="utf-8") as f:
        json.dump({
            "index": index,
            "label": phase.get("label", f"Phase {index}"),
            "duration": phase.get("duration"),
            "delta_file": f"phase-{index:02d}-delta.json",
        }, f)

with open(f"{work_dir}/phase-count.txt", "w", encoding="utf-8") as f:
    f.write(str(len(scenario["phases"])))
PY

META_FILE="$WORK_DIR/meta.json"
START_TIME=$(python3 -c "import json; print(json.load(open('$META_FILE'))['start'])")
INTERVAL_SEC=$(parse_time "$(python3 -c "import json; print(json.load(open('$META_FILE'))['interval'])")" s)
SETTLE_DELAY=$(python3 -c "import json; print(json.load(open('$META_FILE'))['settle'])")
SETTINGS_SETTLE=$(python3 -c "import json; print(json.load(open('$META_FILE'))['settings_settle'])")
BOOT_WAIT=$(python3 -c "import json; print(json.load(open('$META_FILE'))['boot_wait'])")
WARMUP_SEC=$(python3 -c "import json; print(json.load(open('$META_FILE'))['warmup'])")
SCENARIO_OUTPUT=$(python3 -c "import json; print(json.load(open('$META_FILE'))['output'])")
PHASE_COUNT=$(cat "$WORK_DIR/phase-count.txt")

if (( INTERVAL_SEC <= 0 )); then
  echo "Error: interval must be greater than zero" >&2
  exit 1
fi

START_EPOCH=$(parse_start_epoch "$START_TIME")
MSG_CAPTURE_TIME_OFFSET=$(resolve_message_key CaptureTimeOffset 10027)

if [[ -n "$OUTPUT_OVERRIDE" ]]; then
  OUTPUT_DIR="$OUTPUT_OVERRIDE"
elif [[ -n "$SCENARIO_OUTPUT" ]]; then
  OUTPUT_DIR="${SCENARIO_OUTPUT}-$(date +%Y%m%d-%H%M%S)"
else
  OUTPUT_DIR="captures/sim-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$OUTPUT_DIR"

total_duration=0
expected_frames=0
for (( phase_index=1; phase_index<=PHASE_COUNT; phase_index++ )); do
  phase_file="$WORK_DIR/phase-$(printf '%02d' "$phase_index").json"
  phase_duration=$(python3 -c "import json; print(json.load(open('$phase_file'))['duration'])")
  phase_sec=$(parse_time "$phase_duration" m)
  if (( phase_sec <= 0 )); then
    echo "Error: invalid duration in phase $phase_index" >&2
    exit 1
  fi
  phase_frames=$(( phase_sec / INTERVAL_SEC ))
  if (( phase_sec % INTERVAL_SEC != 0 )); then
    phase_frames=$(( phase_frames + 1 ))
  fi
  expected_frames=$(( expected_frames + phase_frames ))
  total_duration=$(( total_duration + phase_sec ))
done

echo "Scenario capture"
echo "  Scenario:   ${SCENARIO_FILE}"
echo "  Start:      $(format_sim_time "$START_EPOCH")"
echo "  Phases:     ${PHASE_COUNT}"
echo "  Duration:   $(format_duration "$total_duration") (${total_duration}s simulated)"
echo "  Interval:   ${INTERVAL_SEC}s"
echo "  Boot wait:  ${BOOT_WAIT}s"
echo "  Warmup:     ${WARMUP_SEC}s"
echo "  Settle:     ${SETTLE_DELAY}s"
echo "  Settings:   ${SETTINGS_SETTLE}s"
echo "  Output:     ${OUTPUT_DIR}/"
echo "  Expected:   ~${expected_frames} frame(s)"
echo ""
echo "Press Ctrl+C to stop early (Ctrl+C twice to force quit)."
echo ""

elapsed=0
trap on_interrupt INT TERM
trap cleanup EXIT

wait_for_emulator

if [[ -s "$WORK_DIR/setup.json" ]] && python3 -c "import json, sys; sys.exit(0 if 'DebugMode' in json.load(open(sys.argv[1])) else 1)" "$WORK_DIR/setup.json" 2>/dev/null; then
  echo "Sending DebugMode before boot wait..."
  send_named_setting "$WORK_DIR/setup.json" DebugMode
fi

if (( BOOT_WAIT > 0 )); then
  echo "Waiting ${BOOT_WAIT}s for PKJS to finish booting..."
  sleep_interruptible "$BOOT_WAIT"
fi

if [[ -s "$WORK_DIR/setup.json" ]]; then
  echo ""
  echo "Applying initial settings..."
  if ! apply_scenario_settings "$WORK_DIR/setup.json" "setup"; then
    echo "Error: failed to apply initial settings." >&2
    exit 1
  fi
else
  echo ""
  echo "Warning: scenario has no setup block; using watch defaults." >&2
fi

if (( WARMUP_SEC > 0 )); then
  echo "Warming up for ${WARMUP_SEC}s..."
  sleep_interruptible "$WARMUP_SEC"
fi

for (( phase_index=1; phase_index<=PHASE_COUNT && !STOP; phase_index++ )); do
  phase_file="$WORK_DIR/phase-$(printf '%02d' "$phase_index").json"
  phase_label=$(python3 -c "import json; print(json.load(open('$phase_file'))['label'])")
  phase_duration=$(python3 -c "import json; print(json.load(open('$phase_file'))['duration'])")
  phase_sec=$(parse_time "$phase_duration" m)
  phase_end=$(( elapsed + phase_sec ))
  phase_last=$(( phase_end - INTERVAL_SEC ))
  if (( phase_last < elapsed )); then
    phase_last=$elapsed
  fi
  delta_file="$WORK_DIR/$(python3 -c "import json; print(json.load(open('$phase_file'))['delta_file'])")"

  echo ""
  echo "Phase ${phase_index}/${PHASE_COUNT}: ${phase_label}"
  echo "  Captures: $(format_sim_time $(( START_EPOCH + elapsed ))) .. $(format_sim_time $(( START_EPOCH + phase_last ))) (every ${INTERVAL_SEC}s)"
  echo "  Next phase from $(format_sim_time $(( START_EPOCH + phase_end )))"

  if [[ -s "$delta_file" ]] && python3 -c "import json, sys; sys.exit(0 if json.load(open(sys.argv[1])) else 1)" "$delta_file"; then
    echo "  Applying changed settings..."
    if ! apply_scenario_settings "$delta_file" "phase ${phase_index}"; then
      echo "Error: failed to apply phase settings." >&2
      exit 1
    fi
  fi

  capture_phase_segment "$phase_end" "$phase_label"
  elapsed=$phase_end
done

exit 0
