#!/usr/bin/env bash
# Capture pebble emulator screenshots on an interval for a set duration.
#
# Real-time mode (default): wait between captures while the emulator clock runs normally.
# Simulate mode (--simulate): shift the watchface display time via CaptureTimeOffset app
# messages. Required on Emery/QEMU 10, where pebble emu-set-time is ignored.
#
# Usage:
#   pebble build && pebble install --emulator emery
#   bash scripts/capture-screenshots.sh --simulate --duration 3h --interval 1m
#
# Stitch frames into a GIF (optional):
#   ffmpeg -framerate 1 -i captures/sim-*/frame-%04d-*.png -loop 0 argus-timelapse.gif
set -eu

# WSL DrvFS: bash reads scripts incrementally from /mnt/c; after sleep or heavy I/O
# the next chunk can fail with "error reading input file: No data available".
# Re-exec from a native Linux temp copy when launched from a Windows mount.
if [[ "${BASH_SOURCE[0]:-}" == /mnt/* ]] && [[ -z "${ARGUS_CAPTURE_REEXEC:-}" ]]; then
  export ARGUS_CAPTURE_REEXEC=1
  tmp=$(mktemp /tmp/argus-capture.XXXXXX.sh)
  cp "${BASH_SOURCE[0]}" "$tmp"
  chmod +x "$tmp"
  exec bash "$tmp" "$@"
fi

STOP=0
CLEANUP_DONE=0

DURATION_SEC=0
INTERVAL_SEC=60
OUTPUT_DIR=""
SIMULATE=0
START_TIME="2026-07-06 09:00:00"
SETTLE_DELAY=""
WARMUP_SEC=""
DEMO_WEATHER=-1

MSG_DEBUG_MODE=10010
MSG_DEMO_WEATHER=10011
MSG_CAPTURE_TIME_OFFSET=10027
APP_UUID="f8c3a2b1-4d5e-6f70-8a9b-0c1d2e3f4a5b"

usage() {
  cat <<'EOF'
Capture pebble screenshots every interval for a set duration.

Usage:
  bash scripts/capture-screenshots.sh --duration DURATION [options]

Options:
  -d, --duration DURATION   Total span to capture (required). Examples: 3h, 90m, 14d
  -i, --interval INTERVAL   Simulated/real seconds between captures (default: 60s)
  -o, --output DIR          Output directory (default: captures/run-... or captures/sim-...)
      --simulate            Shift watchface time via CaptureTimeOffset (requires pebble build)
      --start DATETIME      Simulated start time (default: 2026-07-06 09:00:00, a Monday)
      --settle SECONDS      Pause after each time shift before screenshot (default: 1.5 simulate)
      --warmup SECONDS      Wait before the first capture (default: 0 real / 5 simulate)
      --demo-weather        Enable demo weather via app message (default: on in simulate mode)
      --no-demo-weather     Use live weather instead of demo data
  -h, --help                Show this help

Simulated mode uses an in-app time offset (DebugMode must be on). Emery/QEMU 10 ignores
pebble emu-set-time, so the script sends CaptureTimeOffset instead.

Examples:
  pebble build && pebble install --emulator emery
  bash scripts/capture-screenshots.sh --simulate --duration 3h --interval 1m
EOF
}

parse_time() {
  local value="$1"
  local default_unit="$2"

  if [[ ! "$value" =~ ^[0-9]+([dhms])?$ ]]; then
    echo "Invalid time value: $value (use e.g. 3h, 90m, 14d, 45s)" >&2
    exit 1
  fi

  if [[ "$value" =~ d$ ]]; then
    echo $(( ${value%d} * 86400 ))
  elif [[ "$value" =~ h$ ]]; then
    echo $(( ${value%h} * 3600 ))
  elif [[ "$value" =~ m$ ]]; then
    echo $(( ${value%m} * 60 ))
  elif [[ "$value" =~ s$ ]]; then
    echo ${value%s}
  elif [[ "$default_unit" == "m" ]]; then
    echo $(( value * 60 ))
  else
    echo "$value"
  fi
}

format_duration() {
  local total="$1"
  local days=$(( total / 86400 ))
  local hours=$(( (total % 86400) / 3600 ))
  local minutes=$(( (total % 3600) / 60 ))
  local seconds=$(( total % 60 ))
  if (( days > 0 )); then
    printf '%dd %dh %dm' "$days" "$hours" "$minutes"
  elif (( hours > 0 )); then
    printf '%dh %dm %ds' "$hours" "$minutes" "$seconds"
  elif (( minutes > 0 )); then
    printf '%dm %ds' "$minutes" "$seconds"
  else
    printf '%ds' "$seconds"
  fi
}

parse_start_epoch() {
  local value="$1"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "$value"
    return
  fi
  local epoch
  if ! epoch=$(date -d "$value" +%s 2>/dev/null); then
    echo "Invalid --start value: $value (use e.g. \"2026-07-06 09:00\" or Unix seconds)" >&2
    exit 1
  fi
  echo "$epoch"
}

format_sim_time() {
  date -d "@$1" +"%Y-%m-%d %H:%M"
}

resolve_message_key() {
  local name="$1"
  local fallback="$2"
  local keys_file="build/js/message_keys.json"
  if [[ -f "$keys_file" ]]; then
    python3 - "$name" "$fallback" "$keys_file" <<'PY'
import json, sys
name, fallback, path = sys.argv[1:4]
with open(path, encoding="utf-8") as f:
    keys = json.load(f)
print(keys.get(name, fallback))
PY
  else
    echo "$fallback"
  fi
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

sleep_interruptible() {
  local secs="$1"
  local end=$(( SECONDS + secs ))
  while (( SECONDS < end && !STOP )); do
    sleep 0.2 || break
  done
}

pebble_cmd() {
  pebble "$@" </dev/null
}

take_screenshot() {
  local filename="$1"
  pebble_cmd screenshot --no-open "$filename"
}

send_app_message_int() {
  local -a pairs=()
  while (( $# >= 2 )); do
    pairs+=(--int "$1=$2")
    shift 2
  done
  pebble_cmd send-app-message --app-uuid "$APP_UUID" "${pairs[@]}"
}

enable_debug_mode() {
  echo "Enabling debug mode (required for simulated time)..."
  send_app_message_int "$MSG_DEBUG_MODE" 1
}

enable_demo_weather() {
  echo "Enabling demo weather..."
  send_app_message_int "$MSG_DEMO_WEATHER" 1
}

apply_capture_offset() {
  local elapsed="$1"
  local offset=$(( START_EPOCH + elapsed - $(date +%s) ))
  echo "  Setting time offset to $(format_sim_time $(( START_EPOCH + elapsed )))..."
  send_app_message_int "$MSG_CAPTURE_TIME_OFFSET" "$offset"
}

reset_capture_offset() {
  send_app_message_int "$MSG_CAPTURE_TIME_OFFSET" 0 2>/dev/null || true
}

wait_for_settle() {
  sleep_interruptible "$SETTLE_DELAY"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--duration)
      DURATION_SEC=$(parse_time "$2" m)
      shift 2
      ;;
    -i|--interval)
      INTERVAL_SEC=$(parse_time "$2" s)
      shift 2
      ;;
    -o|--output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --emulator|-e)
      echo "Warning: --emulator is ignored; connect to the already-running emulator instead." >&2
      echo "  Start with: pebble install --emulator emery" >&2
      shift 2
      ;;
    --simulate)
      SIMULATE=1
      shift
      ;;
    --start)
      START_TIME="$2"
      shift 2
      ;;
    --step-delay|--settle)
      SETTLE_DELAY="$2"
      shift 2
      ;;
    --warmup)
      WARMUP_SEC="$2"
      shift 2
      ;;
    --demo-weather)
      DEMO_WEATHER=1
      shift
      ;;
    --no-demo-weather)
      DEMO_WEATHER=0
      shift
      ;;
    --no-poke-refresh)
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if (( DURATION_SEC <= 0 )); then
  echo "Error: --duration is required (e.g. --duration 3h)" >&2
  usage >&2
  exit 1
fi

if (( INTERVAL_SEC <= 0 )); then
  echo "Error: --interval must be greater than zero" >&2
  exit 1
fi

if ! command -v pebble >/dev/null 2>&1; then
  echo "Error: pebble CLI not found in PATH" >&2
  exit 1
fi

if (( DEMO_WEATHER < 0 )); then
  DEMO_WEATHER=$SIMULATE
fi

if [[ -z "$SETTLE_DELAY" ]]; then
  if (( SIMULATE )); then
    if (( DEMO_WEATHER )); then
      SETTLE_DELAY="1.5"
    else
      SETTLE_DELAY="10"
    fi
  else
    SETTLE_DELAY="0"
  fi
fi

if [[ -z "$WARMUP_SEC" ]]; then
  if (( SIMULATE )); then
    WARMUP_SEC="5"
  else
    WARMUP_SEC="0"
  fi
fi

MSG_CAPTURE_TIME_OFFSET=$(resolve_message_key CaptureTimeOffset "$MSG_CAPTURE_TIME_OFFSET")

if [[ -z "$OUTPUT_DIR" ]]; then
  if (( SIMULATE )); then
    OUTPUT_DIR="captures/sim-$(date +%Y%m%d-%H%M%S)"
  else
    OUTPUT_DIR="captures/run-$(date +%Y%m%d-%H%M%S)"
  fi
fi

mkdir -p "$OUTPUT_DIR"

expected=$(( DURATION_SEC / INTERVAL_SEC ))
if (( DURATION_SEC % INTERVAL_SEC != 0 )); then
  expected=$(( expected + 1 ))
fi

START_EPOCH=0
if (( SIMULATE )); then
  START_EPOCH=$(parse_start_epoch "$START_TIME")
  if [[ ! -f build/js/message_keys.json ]]; then
    echo "Error: run 'pebble build' first (needed for CaptureTimeOffset message key)" >&2
    exit 1
  fi
fi

echo "Capturing screenshots"
if (( SIMULATE )); then
  echo "  Mode:       simulated (CaptureTimeOffset)"
  echo "  Start:      $(format_sim_time "$START_EPOCH")"
  echo "  Demo wx:    $(( DEMO_WEATHER ))"
  echo "  Warmup:     ${WARMUP_SEC}s"
  echo "  Settle:     ${SETTLE_DELAY}s"
else
  echo "  Mode:       real time"
  if (( WARMUP_SEC > 0 )); then
    echo "  Warmup:     ${WARMUP_SEC}s"
  fi
fi
echo "  Duration:   $(format_duration "$DURATION_SEC") (${DURATION_SEC}s of watch time)"
echo "  Interval:   ${INTERVAL_SEC}s"
echo "  Output:     ${OUTPUT_DIR}/"
echo "  Expected:   ~${expected} frame(s)"
echo ""
echo "Press Ctrl+C to stop early (Ctrl+C twice to force quit)."
echo ""

elapsed=0
frame=0
failures=0

cleanup() {
  if (( CLEANUP_DONE )); then
    return 0
  fi
  CLEANUP_DONE=1
  if (( SIMULATE )); then
    if (( STOP )); then
      echo "Skipping time reset (interrupted). Reinstall the watchface to restore real time."
    else
      reset_capture_offset
    fi
  fi
  echo ""
  echo "Stopped. Saved ${frame} frame(s) to ${OUTPUT_DIR}/"
  if (( failures > 0 )); then
    echo "Warning: ${failures} capture(s) failed" >&2
  fi
}

trap on_interrupt INT TERM
trap cleanup EXIT

if (( SIMULATE )); then
  enable_debug_mode
  sleep_interruptible 1
  if (( DEMO_WEATHER )); then
    enable_demo_weather
    sleep_interruptible 1
  fi
  if (( STOP )); then
    exit 130
  fi
  if ! apply_capture_offset 0; then
    echo "Error: failed to set CaptureTimeOffset. Is the emulator running with Argus installed?" >&2
    exit 1
  fi
  if (( WARMUP_SEC > 0 )); then
    echo "Warming up for ${WARMUP_SEC}s..."
    sleep_interruptible "$WARMUP_SEC"
  fi
elif (( WARMUP_SEC > 0 )); then
  echo "Warming up for ${WARMUP_SEC}s..."
  sleep_interruptible "$WARMUP_SEC"
fi

while (( !STOP && elapsed < DURATION_SEC )); do
  frame=$(( frame + 1 ))
  sim_epoch=$(( START_EPOCH + elapsed ))
  sim_label=$(date -d "@$sim_epoch" +%Y%m%d-%H%M%S)
  filename=$(printf '%s/frame-%04d-%s.png' "$OUTPUT_DIR" "$frame" "$sim_label")

  if (( SIMULATE )); then
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
        printf '[frame %04d] %s -> %s\n' "$frame" "$(format_sim_time "$sim_epoch")" "$(basename "$filename")"
      else
        failures=$(( failures + 1 ))
        printf '[frame %04d] screenshot FAILED (%s)\n' "$frame" "$(format_sim_time "$sim_epoch")" >&2
      fi
    fi
  else
    if take_screenshot "$filename"; then
      printf '[%s] frame %04d -> %s\n' "$(date +%H:%M:%S)" "$frame" "$(basename "$filename")"
    else
      failures=$(( failures + 1 ))
      printf '[%s] frame %04d FAILED\n' "$(date +%H:%M:%S)" "$frame" >&2
    fi
  fi

  if (( elapsed + INTERVAL_SEC >= DURATION_SEC )); then
    break
  fi

  if (( STOP )); then
    break
  fi

  if (( !SIMULATE )); then
    sleep_interruptible "$INTERVAL_SEC"
  fi
  elapsed=$(( elapsed + INTERVAL_SEC ))
done

exit 0
