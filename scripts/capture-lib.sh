# Shared helpers for Argus emulator screenshot capture scripts.
# Source from capture-screenshots.sh / capture-scenario.sh (do not execute directly).

APP_UUID="${APP_UUID:-f8c3a2b1-4d5e-6f70-8a9b-0c1d2e3f4a5b}"
PEBBLE_RETRIES="${PEBBLE_RETRIES:-4}"
PEBBLE_RETRY_DELAY="${PEBBLE_RETRY_DELAY:-5}"
PEBBLE_CMD_GAP="${PEBBLE_CMD_GAP:-1}"
MSG_KEYS_FILE="${MSG_KEYS_FILE:-build/js/message_keys.json}"

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
    echo "Invalid start time: $value (use e.g. \"2026-07-04 06:00\" or Unix seconds)" >&2
    exit 1
  fi
  echo "$epoch"
}

format_sim_time() {
  date -d "@$1" +"%Y-%m-%d %H:%M"
}

resolve_message_key() {
  local name="$1"
  local fallback="${2:-}"
  if [[ -f "$MSG_KEYS_FILE" ]]; then
    python3 - "$name" "$fallback" "$MSG_KEYS_FILE" <<'PY'
import json, sys
name, fallback, path = sys.argv[1:4]
with open(path, encoding="utf-8") as f:
    keys = json.load(f)
value = keys.get(name)
if value is None:
    if fallback:
        print(fallback)
    else:
        sys.exit(f"Unknown message key: {name}")
else:
    print(value)
PY
  elif [[ -n "$fallback" ]]; then
    echo "$fallback"
  else
    echo "Error: message key $name requires pebble build ($MSG_KEYS_FILE missing)" >&2
    exit 1
  fi
}

sleep_interruptible() {
  local secs="$1"
  local total_ms
  total_ms=$(python3 -c 'import sys; print(max(0, int(float(sys.argv[1]) * 1000)))' "$secs")
  local start_ms
  start_ms=$(date +%s%3N)
  while (( !STOP )); do
    local now_ms
    now_ms=$(date +%s%3N)
    if (( now_ms - start_ms >= total_ms )); then
      break
    fi
    sleep 0.2 || break
  done
}

pebble_cmd() {
  pebble "$@" </dev/null 2>/dev/null
}

pebble_app_message_cmd() {
  pebble "$@" </dev/null
}

run_pebble_with_retry() {
  local desc="$1"
  shift
  local attempt=1
  while (( attempt <= PEBBLE_RETRIES && !STOP )); do
    if pebble_cmd "$@"; then
      sleep_interruptible "$PEBBLE_CMD_GAP"
      return 0
    fi
    if (( attempt < PEBBLE_RETRIES )); then
      echo "  ${desc} failed (attempt ${attempt}/${PEBBLE_RETRIES}), retrying in ${PEBBLE_RETRY_DELAY}s..." >&2
      sleep_interruptible "$PEBBLE_RETRY_DELAY"
    fi
    attempt=$(( attempt + 1 ))
  done
  return 1
}

run_app_message_with_retry() {
  local desc="$1"
  shift
  local attempt=1
  local err_file
  err_file=$(mktemp /tmp/argus-appmsg-err.XXXXXX)
  while (( attempt <= PEBBLE_RETRIES && !STOP )); do
    if pebble_app_message_cmd "$@" 2>"$err_file"; then
      rm -f "$err_file"
      sleep_interruptible "$PEBBLE_CMD_GAP"
      return 0
    fi
    if [[ -s "$err_file" ]]; then
      echo "  ${desc} error: $(tr '\n' ' ' < "$err_file")" >&2
    fi
    if (( attempt < PEBBLE_RETRIES )); then
      echo "  ${desc} failed (attempt ${attempt}/${PEBBLE_RETRIES}), retrying in ${PEBBLE_RETRY_DELAY}s..." >&2
      sleep_interruptible "$PEBBLE_RETRY_DELAY"
    fi
    attempt=$(( attempt + 1 ))
  done
  rm -f "$err_file"
  return 1
}

wait_for_emulator() {
  local tmp
  tmp=$(mktemp /tmp/argus-pebble-check.XXXXXX.png)
  echo "Checking emulator connection..."
  if run_pebble_with_retry "Emulator check" screenshot --no-open "$tmp"; then
    rm -f "$tmp"
    echo "Emulator ready."
    return 0
  fi
  rm -f "$tmp"
  echo "Error: cannot connect to the emulator." >&2
  echo "  Run: bash scripts/reset-emulator.sh && pebble install --emulator emery" >&2
  exit 1
}

take_screenshot() {
  local filename="$1"
  run_pebble_with_retry "Screenshot" screenshot --no-open "$filename"
}

send_app_message_int() {
  local -a pairs=()
  while (( $# >= 2 )); do
    pairs+=(--int "$1=$2")
    shift 2
  done
  run_app_message_with_retry "App message" send-app-message --app-uuid "$APP_UUID" "${pairs[@]}"
}

send_app_message_string() {
  local -a pairs=()
  while (( $# >= 2 )); do
    pairs+=(--string "$1=$2")
    shift 2
  done
  run_app_message_with_retry "App message" send-app-message --app-uuid "$APP_UUID" "${pairs[@]}"
}

send_int_pairs_chunked() {
  local chunk_size="${1:-4}"
  shift
  local -a pairs=("$@")
  local index=0
  local total="${#pairs[@]}"

  while (( index < total )); do
    local -a chunk=()
    local count=0
    while (( index < total && count < chunk_size )); do
      chunk+=(--int "${pairs[index]}")
      index=$(( index + 1 ))
      count=$(( count + 1 ))
    done
    if ! run_app_message_with_retry "App message" send-app-message --app-uuid "$APP_UUID" "${chunk[@]}"; then
      return 1
    fi
    wait_for_settle
  done
  return 0
}

# Send one named setting from a JSON file (ints or strings). Used for display keys
# that must apply reliably, including zero values.
send_named_setting() {
  local json_file="$1"
  local key_name="$2"
  local plan kind pair

  if ! plan=$(
    python3 - "$json_file" "$MSG_KEYS_FILE" "$key_name" <<'PY'
import json, sys

settings_path, keys_path, name = sys.argv[1:4]
with open(settings_path, encoding="utf-8") as f:
    settings = json.load(f)
if name not in settings:
    sys.exit(0)
with open(keys_path, encoding="utf-8") as f:
    keys = json.load(f)
if name not in keys:
    print(f"Unknown message key: {name}", file=sys.stderr)
    sys.exit(1)
value = settings[name]
key_id = keys[name]
if isinstance(value, str):
    print(f"string\t{key_id}={value}")
else:
    if isinstance(value, bool):
        value = 1 if value else 0
    print(f"int\t{key_id}={int(value)}")
PY
  ); then
    return 1
  fi

  if [[ -z "$plan" ]]; then
    return 0
  fi

  kind="${plan%%$'\t'*}"
  pair="${plan#*$'\t'}"

  echo "  Sending ${key_name}=${pair#*=}..."
  if [[ "$kind" == "string" ]]; then
    run_app_message_with_retry "App message" send-app-message --app-uuid "$APP_UUID" \
      --string "$pair"
  else
    run_app_message_with_retry "App message" send-app-message --app-uuid "$APP_UUID" \
      --int "$pair"
  fi
  wait_for_settle
}

# Keys that must be sent alone — zero values and prefs Clay often leaves on F/Bitham/etc.
send_reliable_named_settings() {
  local json_file="$1"
  local key
  for key in ClockFont HeaderDisplay DemoWeather DemoBiometrics TemperatureUnit TemperatureDisplay LocationMode ManualLocation; do
    if python3 -c "import json, sys; sys.exit(0 if sys.argv[2] in json.load(open(sys.argv[1])) else 1)" \
      "$json_file" "$key" 2>/dev/null; then
      if ! send_named_setting "$json_file" "$key"; then
        return 1
      fi
    fi
  done
  return 0
}

# Send settings from a JSON object file (keys are message key names).
# String keys are never mixed with ints — mixed batches were silently failing.
send_settings_from_json() {
  local json_file="$1"
  local label="${2:-settings}"
  local plan
  local -a int_pairs=()
  local -a string_names=()
  local -a string_pairs=()
  local line kind name pair
  local chunk_size=4

  if ! plan=$(
    python3 - "$json_file" "$MSG_KEYS_FILE" <<'PY'
import json, sys

settings_path, keys_path = sys.argv[1:3]
with open(settings_path, encoding="utf-8") as f:
    settings = json.load(f)
if not settings:
    sys.exit(0)
with open(keys_path, encoding="utf-8") as f:
    keys = json.load(f)

priority = [
    "DebugMode",
    "DemoWeather",
    "DemoBiometrics",
    "HeaderDisplay",
    "ClockFont",
    "TemperatureUnit",
    "TemperatureDisplay",
    "LocationMode",
]

def encode(name, value):
    if name not in keys:
        print(f"Unknown message key: {name}", file=sys.stderr)
        sys.exit(1)
    key_id = keys[name]
    if isinstance(value, str):
        return ("string", name, f"{key_id}={value}")
    if isinstance(value, bool):
        return ("int", name, f"{key_id}={1 if value else 0}")
    return ("int", name, f"{key_id}={int(value)}")

encoded = []
seen = set()
for name in priority:
    if name in settings:
        encoded.append(encode(name, settings[name]))
        seen.add(name)
for name in sorted(settings):
    if name not in seen:
        encoded.append(encode(name, settings[name]))

for kind, name, pair in encoded:
    print(f"{kind}\t{name}\t{pair}")
PY
  ); then
    return 1
  fi

  if [[ -z "$plan" ]]; then
    echo "  No ${label} to apply."
    return 0
  fi

  while IFS=$'\t' read -r kind name pair; do
    [[ -z "$kind" ]] && continue
    if [[ "$kind" == "int" ]]; then
      int_pairs+=("$pair")
    else
      string_names+=("$name")
      string_pairs+=("$pair")
    fi
  done <<< "$plan"

  if (( ${#int_pairs[@]} > 0 )); then
    echo "  Sending ${label}: ${#int_pairs[@]} int key(s) in chunks of ${chunk_size}..."
    if ! send_int_pairs_chunked "$chunk_size" "${int_pairs[@]}"; then
      return 1
    fi
  fi

  local index=0
  while (( index < ${#string_pairs[@]} )); do
    echo "  Sending ${label}: string ${string_names[index]}..."
    if ! run_app_message_with_retry "App message" send-app-message --app-uuid "$APP_UUID" \
      --string "${string_pairs[index]}"; then
      return 1
    fi
    wait_for_settle
    index=$(( index + 1 ))
  done

  return 0
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
