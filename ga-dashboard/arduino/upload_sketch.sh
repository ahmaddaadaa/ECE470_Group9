#!/usr/bin/env bash
# Upload MKR WIFI 1010 BLE sketch via arduino-cli
set -euo pipefail
# zsh-safe globs when run under zsh
setopt NULL_GLOB 2>/dev/null || true
shopt -s nullglob 2>/dev/null || true

SKETCH_DIR="$(cd "$(dirname "$0")/mkr_wifi1010_ble_control" && pwd)"
FQBN="arduino:samd:mkrwifi1010"

# Close anything holding the serial port
pkill -9 -f serial-mo 2>/dev/null || true
pkill -9 -f "arduino-cli monitor" 2>/dev/null || true
for p in $(lsof -t /dev/cu.usbmodem* 2>/dev/null || true); do
  kill -9 "$p" 2>/dev/null || true
done
sleep 0.5

PORT=$(arduino-cli board list 2>/dev/null | awk '/mkrwifi1010|MKR WiFi/{print $1; exit}')
if [[ -z "${PORT:-}" ]]; then
  ports=(/dev/cu.usbmodem*)
  if [[ -e "${ports[0]:-}" ]]; then
    PORT="${ports[0]}"
  fi
fi

if [[ -z "${PORT:-}" ]]; then
  echo "No MKR WIFI 1010 found."
  echo "Plug in a USB data cable and try again."
  arduino-cli board list 2>/dev/null || true
  exit 1
fi

echo "Board port: $PORT"
echo "Sketch:     $SKETCH_DIR"
echo "Compiling..."
arduino-cli compile --fqbn "$FQBN" "$SKETCH_DIR"

# SAMD bootloader kick
python3 - "$PORT" <<'PY' 2>/dev/null || true
import serial, sys, time
try:
    s = serial.Serial(sys.argv[1], 1200)
    s.close()
    print("1200-baud reset ok")
except Exception as e:
    print("reset note:", e)
time.sleep(1.4)
PY

PORT=$(ls /dev/cu.usbmodem* 2>/dev/null | head -1 || echo "$PORT")
echo "Uploading to $PORT ..."
arduino-cli upload -p "$PORT" --fqbn "$FQBN" "$SKETCH_DIR"
echo "Done. LED should slow-blink (advertising as G9)."
