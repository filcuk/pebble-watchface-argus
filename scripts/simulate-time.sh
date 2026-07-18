#!/usr/bin/env bash
# One-shot watchface date/time simulation via CaptureTimeOffset.
#
# Usage (emulator already running with Argus installed):
#   bash scripts/simulate-time.sh "2026-12-25 15:00"
#   bash scripts/simulate-time.sh --reset
#
# DebugMode is enabled automatically. Emery/QEMU 10 ignores pebble emu-set-time.
set -eu

if [[ -z "${ARGUS_SCRIPTS_DIR:-}" ]]; then
  ARGUS_SCRIPTS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
fi

if [[ "${BASH_SOURCE[0]:-}" == /mnt/* ]] && [[ -z "${ARGUS_CAPTURE_REEXEC:-}" ]]; then
  export ARGUS_CAPTURE_REEXEC=1
  export ARGUS_SCRIPTS_DIR
  tmp=$(mktemp /tmp/argus-simulate-time.XXXXXX.sh)
  cp "${BASH_SOURCE[0]}" "$tmp"
  chmod +x "$tmp"
  exec bash "$tmp" "$@"
fi

SCRIPT_DIR="$ARGUS_SCRIPTS_DIR"
# shellcheck source=capture-lib.sh
source "$SCRIPT_DIR/capture-lib.sh"

STOP=0
RESET=0
DEMO_WEATHER=0
WHEN=""

usage() {
  cat <<'EOF'
Set the Argus watchface clock to a simulated date/time (one-shot).

Usage:
  bash scripts/simulate-time.sh DATETIME
  bash scripts/simulate-time.sh --reset

Arguments:
  DATETIME              Desired local time, e.g. "2026-12-25 15:00"
                        or Unix epoch seconds

Options:
  --reset               Clear CaptureTimeOffset (return to real time)
  --demo-weather        Also enable DemoWeather
  -h, --help            Show this help

Requires:
  - Emulator already running with Argus installed
  - pebble build (for message key ids in build/js/message_keys.json)

Examples:
  bash scripts/simulate-time.sh "2026-07-06 09:00"
  bash scripts/simulate-time.sh "2026-12-25 15:30:00"
  bash scripts/simulate-time.sh --demo-weather "2026-01-01 00:00"
  bash scripts/simulate-time.sh --reset
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset)
      RESET=1
      shift
      ;;
    --demo-weather)
      DEMO_WEATHER=1
      shift
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
      if [[ -n "$WHEN" ]]; then
        echo "Error: unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      WHEN="$1"
      shift
      ;;
  esac
done

if (( !RESET )) && [[ -z "$WHEN" ]]; then
  echo "Error: DATETIME is required (or use --reset)" >&2
  usage >&2
  exit 1
fi

if (( RESET )) && [[ -n "$WHEN" ]]; then
  echo "Error: pass either DATETIME or --reset, not both" >&2
  usage >&2
  exit 1
fi

if ! command -v pebble >/dev/null 2>&1; then
  echo "Error: pebble CLI not found in PATH" >&2
  exit 1
fi

MSG_DEBUG_MODE=$(resolve_message_key DebugMode 10010)
MSG_DEMO_WEATHER=$(resolve_message_key DemoWeather 10011)
MSG_CAPTURE_TIME_OFFSET=$(resolve_message_key CaptureTimeOffset 10027)

if [[ ! -f "$MSG_KEYS_FILE" ]]; then
  echo "Warning: $MSG_KEYS_FILE missing; using fallback message key ids (run pebble build if send fails)" >&2
fi

wait_for_emulator

echo "Enabling debug mode (required for simulated time)..."
if ! send_app_message_int "$MSG_DEBUG_MODE" 1; then
  echo "Error: failed to enable DebugMode. Is Argus installed on the emulator?" >&2
  exit 1
fi

if (( DEMO_WEATHER )); then
  echo "Enabling demo weather..."
  if ! send_app_message_int "$MSG_DEMO_WEATHER" 1; then
    echo "Error: failed to enable DemoWeather" >&2
    exit 1
  fi
fi

if (( RESET )); then
  echo "Clearing CaptureTimeOffset (real time)..."
  if ! send_app_message_int "$MSG_CAPTURE_TIME_OFFSET" 0; then
    echo "Error: failed to reset CaptureTimeOffset" >&2
    exit 1
  fi
  echo "Done. Watchface time offset cleared."
  exit 0
fi

TARGET_EPOCH=$(parse_start_epoch "$WHEN")
OFFSET=$(( TARGET_EPOCH - $(date +%s) ))

echo "Setting simulated time to $(format_sim_time "$TARGET_EPOCH") (offset ${OFFSET}s)..."
if ! send_app_message_int "$MSG_CAPTURE_TIME_OFFSET" "$OFFSET"; then
  echo "Error: failed to set CaptureTimeOffset. Is Argus installed on the emulator?" >&2
  exit 1
fi

echo "Done. Watchface now shows $(format_sim_time "$TARGET_EPOCH")."
echo "  Clear with: bash scripts/simulate-time.sh --reset"
