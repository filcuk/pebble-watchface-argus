#!/usr/bin/env bash
# Stop stuck Pebble emulator processes and optionally reset corrupted flash.
set -eu

echo "Stopping Pebble emulator..."
pebble kill --force || true
sleep 2
pebble kill --force || true
sleep 1

if pgrep -x qemu-pebble >/dev/null 2>&1; then
  echo "qemu-pebble is still running. Close emulator windows, then run:"
  echo "  pebble kill --force"
  pgrep -a qemu-pebble || true
  exit 1
fi

if [ "${1:-}" = "--reset-flash" ]; then
  flash="${HOME}/.local/share/pebble-sdk/4.17/emery/qemu_spi_flash.bin"
  if [ -f "${flash}" ]; then
    echo "Removing emulator flash (fixes boot loop after crashed installs): ${flash}"
    rm -f "${flash}"
  fi
fi

echo "Done. Next:"
echo "  pebble build"
echo "  pebble install --emulator emery"
echo ""
echo "If the emulator still boot-loops, rerun with --reset-flash:"
echo "  bash scripts/reset-emulator.sh --reset-flash"
