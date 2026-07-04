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
# Simulated capture enables demo weather by default so the chart stays populated.
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
SETTLE_DELAY=""
WARMUP_SEC=""
DEMO_WEATHER=-1
POKE_REFRESH=1

MSG_HOUR_FORMAT=10000
MSG_DEBUG_MODE=10010
MSG_DEMO_WEATHER=10011

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
      --step-delay SECONDS  Pause after emu-set-time before screenshot (default: 0.3 real / 1.5 simulate)
      --settle SECONDS      Alias for --step-delay in simulate mode
      --warmup SECONDS      Wait before the first capture (default: 0 real / 8 simulate)
      --demo-weather        Enable demo weather via app message (default: on in simulate mode)
      --no-demo-weather     Use live weather instead of demo data
      --no-poke-refresh     Skip app-message refresh after each simulated time jump
  -h, --help                Show this help

Duration and interval accept an optional suffix:
  h = hours, m = minutes, s = seconds, d = days
  A bare number is treated as minutes for --duration, seconds for --interval.

Examples:
  # Real time: one frame per minute for 3 hours
  bash scripts/capture-screenshots.sh --duration 3h

  # Simulated: 3 hours of watch time (~180 frames, demo weather on by default)
  bash scripts/capture-screenshots.sh --simulate --duration 3h --interval 1m -e emery

  # Simulated with live weather (slower — waits longer for fetches)
  bash scripts/capture-screenshots.sh --simulate -d 3h -i 1m --no-demo-weather --warmup 30 --settle 10
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

pebble_with_emulator_args() {
  local subcommand="$1"
  shift
  local -a args=("$subcommand" "$@")
  if [[ -n "$EMULATOR" ]]; then
    if pebble_supports_emulator_flag "$subcommand"; then
      args+=(--emulator "$EMULATOR")
    else
      echo "Warning: pebble $subcommand has no --emulator flag; using the running emulator" >&2
    fi
  fi
  pebble "${args[@]}"
}

set_emulator_time() {
  local epoch="$1"
  pebble_with_emulator_args emu-set-time "$epoch"
}

take_screenshot() {
  local filename="$1"
  pebble_with_emulator_args screenshot --no-open "$filename"
}

send_app_message_int() {
  local -a pairs=()
  while (( $# >= 2 )); do
    pairs+=(--int "$1=$2")
    shift 2
  done
  pebble_with_emulator_args send-app-message "${pairs[@]}"
}

enable_demo_weather() {
  echo "Enabling demo weather (DebugMode + DemoWeather)..."
  send_app_message_int "$MSG_DEBUG_MODE" 1 "$MSG_DEMO_WEATHER" 1
}

refresh_watchface() {
  # Any inbound settings message triggers prv_refresh_all_modules() on the watch.
  send_app_message_int "$MSG_HOUR_FORMAT" 0
}

wait_for_settle() {
  sleep "$SETTLE_DELAY"
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
      POKE_REFRESH=0
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
    SETTLE_DELAY="$STEP_DELAY"
  fi
fi

if [[ -z "$WARMUP_SEC" ]]; then
  if (( SIMULATE )); then
    if (( DEMO_WEATHER )); then
      WARMUP_SEC="8"
    else
      WARMUP_SEC="30"
    fi
  else
    WARMUP_SEC="0"
  fi
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
  echo "  Mode:       simulated (pebble emu-set-time)"
  echo "  Start:      $(format_sim_time "$START_EPOCH")"
  echo "  Demo wx:    $(( DEMO_WEATHER )) (instant chart data)"
  echo "  Warmup:     ${WARMUP_SEC}s (before first capture)"
  echo "  Settle:     ${SETTLE_DELAY}s (after each time jump)"
  echo "  Refresh:    $(( POKE_REFRESH )) (app message after each jump)"
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

if (( SIMULATE )); then
  if (( DEMO_WEATHER )); then
    enable_demo_weather
    sleep 1
  fi
  if ! set_emulator_time "$START_EPOCH"; then
    echo "Error: failed to set initial emulator time" >&2
    exit 1
  fi
  if (( POKE_REFRESH )); then
    refresh_watchface
  fi
  if (( WARMUP_SEC > 0 )); then
    echo "Warming up for ${WARMUP_SEC}s..."
    sleep "$WARMUP_SEC"
  fi
elif (( WARMUP_SEC > 0 )); then
  echo "Warming up for ${WARMUP_SEC}s..."
  sleep "$WARMUP_SEC"
fi

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
      if (( POKE_REFRESH )); then
        refresh_watchface || true
      fi
      wait_for_settle
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
