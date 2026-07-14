# Arduino MKR WIFI 1010 (BLE)

Wireless link to the React dashboard. **After upload, USB data is not required** — only power + Bluetooth.

## Demo without laptop USB cable

1. Upload `mkr_wifi1010_ble_control/mkr_wifi1010_ble_control.ino` once (USB to laptop).
2. Unplug from the laptop.
3. Power the board with a **USB power bank** (or battery on VIN).
4. Built-in LED **slow blinks** = advertising (waiting for Chrome).
5. Laptop: Chrome → dashboard → **Connect board** → **ECE470-MKR1010**.
6. LED **solid on** = BLE connected. Run GA with **Auto send** so levels go over BLE.

**Important:** unplugging USB with **no** power bank means the board is **off**. BLE cannot work with no power.

## Upload (once)

1. Board: **Arduino MKR WIFI 1010**
2. Library: **ArduinoBLE**
3. Upload the `.ino`
4. Optional Serial @ 115200 (only if USB data is connected)

## What the dashboard sends (over BLE only)

```text
N,M,C,H
```

levels 0–7. Example: `0,2,5,0`.

Board replies on status char: `OK N=…` and pot `E=…` for extra heat.

## Pins

| Job | Pin |
|-----|-----|
| Nutrients LED | 2 |
| Servo | 3 |
| Fan | 4 |
| Heating LED | 5 |
| Pot | A1 |

## LED meaning

| LED | Meaning |
|-----|---------|
| Slow blink | Powered, advertising (find me in Chrome) |
| Solid on | BLE connected / got a command |
| Fast blink forever | BLE.begin() failed |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Not found without USB | Use a **power bank**. Board needs power. |
| Not in list | Reset board; wait for slow blink; Chrome only |
| Connects but no actuators | **Auto send** or **Send levels**; check wiring |
| Worked then vanished | Power cycle board; click Connect again |

## Code

- Sketch: `mkr_wifi1010_ble_control/mkr_wifi1010_ble_control.ino`
- Browser: `src/ble/arduinoBle.js`
