// BLE client for the MKR WIFI 1010 sketch (same UUIDs as the .ino file).
// Works in Chrome/Edge on localhost or HTTPS.

export const BLE_SERVICE = "19b10000-e8f2-537e-4f6c-d104768a1214";
export const BLE_CMD = "19b10001-e8f2-537e-4f6c-d104768a1214";
export const BLE_TEMP = "19b10002-e8f2-537e-4f6c-d104768a1214";
export const BLE_STATUS = "19b10003-e8f2-537e-4f6c-d104768a1214";

export function bleSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

function clampLevel(v) {
  const n = Number(v) | 0;
  return Math.max(0, Math.min(7, n));
}

export async function connectArduino(handlers = {}) {
  if (!bleSupported()) {
    throw new Error(
      "Web Bluetooth not available. Use Chrome/Edge on localhost or HTTPS."
    );
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: "ECE470" }],
    optionalServices: [BLE_SERVICE]
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLE_SERVICE);
  const cmdChar = await service.getCharacteristic(BLE_CMD);
  const tempChar = await service.getCharacteristic(BLE_TEMP);
  const statusChar = await service.getCharacteristic(BLE_STATUS);

  const onGattDisconnected = () => {
    handlers.onDisconnect && handlers.onDisconnect();
  };
  device.addEventListener("gattserverdisconnected", onGattDisconnected);

  // Temperature notifications (float32 little-endian)
  const onTemp = (event) => {
    const value = event.target.value;
    if (!value || value.byteLength < 4) return;
    const t = value.getFloat32(0, true);
    if (Number.isFinite(t)) handlers.onTemperature && handlers.onTemperature(t);
  };
  await tempChar.startNotifications();
  tempChar.addEventListener("characteristicvaluechanged", onTemp);

  // Initial reads
  try {
    const tv = await tempChar.readValue();
    if (tv.byteLength >= 4) {
      const t = tv.getFloat32(0, true);
      if (Number.isFinite(t)) handlers.onTemperature && handlers.onTemperature(t);
    }
  } catch (_) {
    /* ignore */
  }

  try {
    const sv = await statusChar.readValue();
    const text = new TextDecoder().decode(sv.buffer);
    handlers.onStatus && handlers.onStatus(text);
  } catch (_) {
    /* ignore */
  }

  async function sendLevels({ n = 0, m = 0, c = 0, h = 0 }) {
    if (!device.gatt?.connected) throw new Error("Not connected");
    const nn = clampLevel(n);
    const mm = clampLevel(m);
    const cc = clampLevel(c);
    const hh = clampLevel(h);
    // ASCII "N,M,C,H" — easy to debug on Serial Monitor
    const text = `${nn},${mm},${cc},${hh}`;
    const data = new TextEncoder().encode(text);
    if (cmdChar.properties.writeWithoutResponse) {
      await cmdChar.writeValueWithoutResponse(data);
    } else {
      await cmdChar.writeValue(data);
    }
    return { n: nn, m: mm, c: cc, h: hh, text };
  }

  async function sendFromAction(action) {
    if (!action) return null;
    return sendLevels({
      n: action.nutrients ?? action.n ?? 0,
      m: action.mixing ?? action.m ?? 0,
      c: action.cooling ?? action.c ?? 0,
      h: action.heating ?? action.h ?? 0
    });
  }

  function disconnect() {
    try {
      tempChar.removeEventListener("characteristicvaluechanged", onTemp);
    } catch (_) {
      /* ignore */
    }
    device.removeEventListener("gattserverdisconnected", onGattDisconnected);
    if (device.gatt?.connected) device.gatt.disconnect();
  }

  return {
    device,
    sendLevels,
    sendFromAction,
    disconnect,
    get connected() {
      return !!device.gatt?.connected;
    },
    get name() {
      return device.name || "ECE470-MKR1010";
    }
  };
}
