#!/usr/bin/env bash
# Capture pebble emulator screenshots on an interval for a set duration.
#
# Usage:
#   bash scripts/capture-screenshots.sh --duration 3h
#   bash scripts/capture-screenshots.sh --duration 30m --interval 30s
#   bash scripts/capture-screenshots.sh --duration 1h --emulator emery --output captures/demo
#
# Requires a running emulator with the watchface installed:
#   pebble install --emulator emery
#
# Stitch frames into a GIF (optional):
#   ffmpeg -framerate 1 -i captures/run-*/frame-%04d.png -loop 0 argus-timelapse.gif
set -eu

DURATION_SEC=0
INTERVAL_SEC=60
OUTPUT_DIR=""
EMULATOR=""

usage() {
  cat <<'EOF'
Capture pebble screenshots every interval for a set duration.

Usage:
  bash scripts/capture-screenshots.sh --duration DURATION [options]

Options:
  -d, --duration DURATION   Total run time (required). Examples: 3h, 90m, 3600s
  -i, --interval INTERVAL   Seconds between captures (default: 60s / 1m)
  -o, --output DIR          Output directory (default: captures/run-YYYYMMDD-HHMMSS)
  -e, --emulator PLATFORM   Pass --emulator to pebble screenshot (e.g. emery)
  -h, --help                Show this help

Duration and interval accept an optional suffix:
  h = hours, m = minutes, s = seconds
  A bare number is treated as minutes for --duration, seconds for --interval.

Examples:
  bash scripts/capture-screenshots.sh --duration 3h
  bash scripts/capture-screenshots.sh -d 45m -i 30s -e emery
EOF
}

# Parse values like 3h, 90m, 45s, or bare numbers (default_unit: m or s).
parse_time() {
  local value="$1"
  local default_unit="$2"

  if [[ ! "$value" =~ ^[0-9]+([hms])?$ ]]; then
    echo "Invalid time value: $value (use e.g. 3h, 90m, 45s)" >&2
    exit 1
  fi

  if [[ "$value" =~ h$ ]]; then
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
  local hours=$(( total / 3600 ))
  local minutes=$(( (total % 3600) / 60 ))
  local seconds=$(( total % 60 ))
  if (( hours > 0 )); then
    printf '%dh %dm %ds' "$hours" "$minutes" "$seconds"
  elif (( minutes > 0 )); then
    printf '%dm %ds' "$minutes" "$seconds"
  else
    printf '%ds' "$seconds"
  fi
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
  OUTPUT_DIR="captures/run-$(date +%Y%m%d-%H%M%S)"
fi

mkdir -p "$OUTPUT_DIR"

PEBBLE_ARGS=(screenshot --no-open)
if [[ -n "$EMULATOR" ]]; then
  if pebble screenshot --help 2>&1 | grep -q '\--emulator'; then
    PEBBLE_ARGS+=(--emulator "$EMULATOR")
  else
    echo "Warning: this pebble-tool build has no --emulator flag for screenshot; using the running emulator" >&2
  fi
fi

expected=$(( DURATION_SEC / INTERVAL_SEC ))
if (( DURATION_SEC % INTERVAL_SEC != 0 )); then
  expected=$(( expected + 1 ))
fi

echo "Capturing screenshots"
echo "  Duration: $(format_duration "$DURATION_SEC") (${DURATION_SEC}s)"
echo "  Interval: ${INTERVAL_SEC}s"
echo "  Output:   ${OUTPUT_DIR}/"
echo "  Expected: ~${expected} frame(s)"
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
  filename=$(printf '%s/frame-%04d-%s.png' "$OUTPUT_DIR" "$frame" "$(date +%H%M%S)")

  if pebble "${PEBBLE_ARGS[@]}" "$filename"; then
    printf '[%s] frame %04d -> %s\n' "$(date +%H:%M:%S)" "$frame" "$(basename "$filename")"
  else
    failures=$(( failures + 1 ))
    printf '[%s] frame %04d FAILED\n' "$(date +%H:%M:%S)" "$frame" >&2
  fi

  if (( elapsed + INTERVAL_SEC >= DURATION_SEC )); then
    break
  fi

  sleep "$INTERVAL_SEC"
  elapsed=$(( elapsed + INTERVAL_SEC ))
done
