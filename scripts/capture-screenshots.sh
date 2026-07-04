#!/usr/bin/env bash
# Capture pebble emulator screenshots on an interval for a set duration.
#
# Real-time mode (default): wait between captures while the emulator clock runs normally.
# Simulate mode (--simulate): advance emulator time with pebble emu-set-time between captures.
#
# Usage:
#   bash scripts/capture-screenshots.sh --duration 3h
#   bash scripts/capture-screenshots.sh --simulate --duration 3h --interval 1m
#   bash scripts/capture-screenshots.sh --simulate -d 14d -i 1h --start "2026-07-06 09:00"
#
# Requires a running emulator with the watchface installed:
#   pebble install --emulator emery
#
# Enable Demo weather in Clay settings before simulated capture.
#
# Stitch frames into a GIF (optional):
#   ffmpeg -framerate 1 -i captures/sim-*/frame-%04d-*.png -loop 0 argus-timelapse.gif
set -eu

DURATION_SEC=0
INTERVAL_SEC=60
OUTPUT_DIR=""
EMULATOR=""
SIMULATE=0
START_TIME="2026-07-06 09:00:00"
STEP_DELAY="0.3"

usage() {
  cat <<'EOF'
Capture pebble screenshots every interval for a set duration.

Usage:
  bash scripts/capture-screenshots.sh --duration DURATION [options]

Options:
  -d, --duration DURATION   Total span to capture (required). Examples: 3h, 90m, 14d
  -i, --interval INTERVAL   Simulated/real seconds between captures (default: 60s)
  -o, --output DIR          Output directory (default: captures/run-... or captures/sim-...)
  -e, --emulator PLATFORM   Pass --emulator to pebble commands (e.g. emery)
      --simulate            Advance emulator time instead of waiting in real time
      --start DATETIME      Simulated start time (default: 2026-07-06 09:00:00, a Monday)
      --step-delay SECONDS  Pause after emu-set-time before screenshot (default: 0.3)
  -h, --help                Show this help

Duration and interval accept an optional suffix:
  h = hours, m = minutes, s = seconds, d = days
  A bare number is treated as minutes for --duration, seconds for --interval.

Examples:
  # Real time: one frame per minute for 3 hours
  bash scripts/capture-screenshots.sh --duration 3h

  # Simulated: 3 hours of watch time in ~1 minute of script runtime
  bash scripts/capture-screenshots.sh --simulate --duration 3h --interval 1m -e emery

  # Simulated: two-week calendar rollover, one frame per hour
  bash scripts/capture-screenshots.sh --simulate -d 14d -i 1h --start "2026-07-06 09:00"
EOF
}

# Parse values like 3h, 90m, 45s, 14d, or bare numbers (default_unit: m or s).
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

pebble_supports_emulator_flag() {
  local subcommand="$1"
  pebble "$subcommand" --help 2>&1 | grep -q '\--emulator'
}

set_emulator_time() {
  local epoch="$1"
  local -a args=(emu-set-time)
  if [[ -n "$EMULATOR" ]]; then
    if pebble_supports_emulator_flag emu-set-time; then
      args+=(--emulator "$EMULATOR")
    else
      echo "Warning: pebble emu-set-time has no --emulator flag; using the running emulator" >&2
    fi
  fi
  args+=("$epoch")
  pebble "${args[@]}"
}

take_screenshot() {
  local filename="$1"
  local -a args=(screenshot --no-open)
  if [[ -n "$EMULATOR" ]]; then
    if pebble_supports_emulator_flag screenshot; then
      args+=(--emulator "$EMULATOR")
    else
      echo "Warning: pebble screenshot has no --emulator flag; using the running emulator" >&2
    fi
  fi
  args+=("$filename")
  pebble "${args[@]}"
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
    -e|--emulator)
      EMULATOR="$2"
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
    --step-delay)
      STEP_DELAY="$2"
      shift 2
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
fi

echo "Capturing screenshots"
if (( SIMULATE )); then
  echo "  Mode:     simulated (pebble emu-set-time)"
  echo "  Start:    $(format_sim_time "$START_EPOCH")"
  echo "  Step delay: ${STEP_DELAY}s (after each time jump)"
else
  echo "  Mode:     real time"
fi
echo "  Duration: $(format_duration "$DURATION_SEC") (${DURATION_SEC}s of watch time)"
echo "  Interval: ${INTERVAL_SEC}s"
echo "  Output:   ${OUTPUT_DIR}/"
echo "  Expected: ~${expected} frame(s)"
if (( SIMULATE )); then
  echo ""
  echo "Tip: enable Demo weather in Clay settings before starting."
fi
echo ""
echo "Press Ctrl+C to stop early."
echo ""

elapsed=0
frame=0
failures=0

cleanup() {
  echo ""
  echo "Stopped. Saved ${frame} frame(s) to ${OUTPUT_DIR}/"
  if (( failures > 0 )); then
    echo "Warning: ${failures} capture(s) failed" >&2
  fi
}
trap cleanup EXIT INT TERM

while (( elapsed < DURATION_SEC )); do
  frame=$(( frame + 1 ))
  sim_epoch=$(( START_EPOCH + elapsed ))
  sim_label=$(date -d "@$sim_epoch" +%Y%m%d-%H%M%S)
  filename=$(printf '%s/frame-%04d-%s.png' "$OUTPUT_DIR" "$frame" "$sim_label")

  if (( SIMULATE )); then
    if ! set_emulator_time "$sim_epoch"; then
      failures=$(( failures + 1 ))
      printf '[frame %04d] emu-set-time FAILED (%s)\n' "$frame" "$(format_sim_time "$sim_epoch")" >&2
    else
      sleep "$STEP_DELAY"
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

  if (( ! SIMULATE )); then
    sleep "$INTERVAL_SEC"
  fi
  elapsed=$(( elapsed + INTERVAL_SEC ))
done
