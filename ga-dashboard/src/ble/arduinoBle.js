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

export function parseStatusText(text) {
  const out = { raw: text, extraHeat: null, ok: null };
  if (!text) return out;

  const eMatch = text.match(/E\s*=\s*([-+0-9.]+)/i);
  if (eMatch) {
    const e = Number(eMatch[1]);
    if (Number.isFinite(e)) out.extraHeat = Math.max(-2.5, Math.min(2.5, e));
  }

  const dMatch = text.match(/D\s*=\s*([0-9.]+)/i);
  if (dMatch && out.extraHeat == null) {
    const d = Number(dMatch[1]);
    if (Number.isFinite(d)) {
      out.extraHeat = Math.max(-2.5, Math.min(2.5, (d - 1.25) * 3));
    }
  }

  if (/^OK/i.test(text)) out.ok = text;
  return out;
}

async function pickDevice() {
  // Prefer named board; fall back to full picker if filters miss it
  try {
    return await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: "ECE470" },
        { name: "ECE470-MKR1010" },
        { services: [BLE_SERVICE] }
      ],
      optionalServices: [BLE_SERVICE]
    });
  } catch (e1) {
    if (e1 && e1.name === "NotFoundError") {
      return navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_SERVICE]
      });
    }
    throw e1;
  }
}

async function connectGatt(device) {
  let lastErr;
  for (let i = 0; i < 5; i += 1) {
    try {
      if (!device.gatt.connected) {
        return await device.gatt.connect();
      }
      return device.gatt;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  throw lastErr || new Error("GATT connect failed");
}

/** Write text command; try reliable write first, then without-response. */
async function writeCmd(cmdChar, data) {
  // With-response is more reliable over the air for demos
  try {
    if (cmdChar.properties.write) {
      await cmdChar.writeValue(data);
      return;
    }
  } catch (_) {}

  if (cmdChar.properties.writeWithoutResponse) {
    await cmdChar.writeValueWithoutResponse(data);
    return;
  }

  await cmdChar.writeValue(data);
}

export async function connectArduino(handlers = {}) {
  if (!bleSupported()) {
    throw new Error("Web Bluetooth needs Chrome (or Edge).");
  }

  const device = await pickDevice();
  if (!device.gatt) {
    throw new Error("No GATT on device");
  }

  await connectGatt(device);

  const service = await device.gatt.getPrimaryService(BLE_SERVICE);
  const cmdChar = await service.getCharacteristic(BLE_CMD);
  const tempChar = await service.getCharacteristic(BLE_TEMP);
  const statusChar = await service.getCharacteristic(BLE_STATUS);

  const onGattDisconnected = () => {
    if (handlers.onDisconnect) handlers.onDisconnect();
  };
  device.addEventListener("gattserverdisconnected", onGattDisconnected);

  const onTemp = (event) => {
    const value = event.target.value;
    if (!value || value.byteLength < 4) return;
    const t = value.getFloat32(0, true);
    if (Number.isFinite(t) && handlers.onTemperature) handlers.onTemperature(t);
  };

  const handleStatusBuffer = (value) => {
    if (!value) return;
    const text = new TextDecoder("utf-8").decode(value.buffer || value);
    if (handlers.onStatus) handlers.onStatus(text);
    const parsed = parseStatusText(text);
    if (parsed.extraHeat != null && handlers.onExtraHeat) {
      handlers.onExtraHeat(parsed.extraHeat);
    }
  };

  const onStatus = (event) => handleStatusBuffer(event.target.value);

  try {
    await tempChar.startNotifications();
    tempChar.addEventListener("characteristicvaluechanged", onTemp);
  } catch (_) {}

  try {
    await statusChar.startNotifications();
    statusChar.addEventListener("characteristicvaluechanged", onStatus);
  } catch (_) {}

  try {
    const tv = await tempChar.readValue();
    if (tv.byteLength >= 4) {
      const t = tv.getFloat32(0, true);
      if (Number.isFinite(t) && handlers.onTemperature) handlers.onTemperature(t);
    }
  } catch (_) {}

  try {
    const sv = await statusChar.readValue();
    handleStatusBuffer(sv);
  } catch (_) {}

  // Backup poll if notifications drop (common on some stacks)
  const pollTimer = setInterval(async () => {
    if (!device.gatt?.connected) return;
    try {
      const sv = await statusChar.readValue();
      handleStatusBuffer(sv);
    } catch (_) {}
  }, 500);

  async function ensureConnected() {
    if (device.gatt?.connected) return true;
    try {
      await connectGatt(device);
      return !!device.gatt?.connected;
    } catch (_) {
      return false;
    }
  }

  async function sendLevels({ n = 0, m = 0, c = 0, h = 0 }) {
    const ok = await ensureConnected();
    if (!ok) throw new Error("Not connected");

    const nn = clampLevel(n);
    const mm = clampLevel(m);
    const cc = clampLevel(c);
    const hh = clampLevel(h);
    const text = `${nn},${mm},${cc},${hh}`;
    const data = new TextEncoder().encode(text);

    try {
      await writeCmd(cmdChar, data);
    } catch (_) {
      // one retry after short reconnect
      await ensureConnected();
      await writeCmd(cmdChar, data);
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
    clearInterval(pollTimer);
    try {
      tempChar.removeEventListener("characteristicvaluechanged", onTemp);
      statusChar.removeEventListener("characteristicvaluechanged", onStatus);
    } catch (_) {}
    device.removeEventListener("gattserverdisconnected", onGattDisconnected);
    if (device.gatt?.connected) device.gatt.disconnect();
  }

  // Handshake so actuators / status update right after connect
  try {
    await sendLevels({ n: 0, m: 0, c: 0, h: 0 });
  } catch (_) {}

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
