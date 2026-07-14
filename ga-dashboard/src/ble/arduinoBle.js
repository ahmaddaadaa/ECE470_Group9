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

function clampHeat(e) {
  if (!Number.isFinite(e)) return null;
  return Math.max(-2.5, Math.min(2.5, e));
}

export function parseStatusText(text) {
  const out = { raw: text, extraHeat: null };
  if (!text) return out;
  const eMatch = String(text).match(/E\s*=\s*([-+0-9.]+)/i);
  if (eMatch) out.extraHeat = clampHeat(Number(eMatch[1]));
  return out;
}

function bytesToText(value) {
  if (!value) return "";
  const u8 =
    value instanceof Uint8Array
      ? value
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new TextDecoder("utf-8").decode(u8).replace(/\0/g, "").trim();
}

async function pickDevice() {
  const opts = { optionalServices: [BLE_SERVICE] };
  try {
    return await navigator.bluetooth.requestDevice({
      filters: [{ name: "G9" }, { namePrefix: "G9" }],
      ...opts
    });
  } catch (e) {
    if (!e || (e.name !== "NotFoundError" && e.name !== "NetworkError")) throw e;
  }
  return navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    ...opts
  });
}

async function connectGatt(device) {
  let lastErr;
  for (let i = 0; i < 5; i += 1) {
    try {
      if (device.gatt.connected) return device.gatt;
      return await device.gatt.connect();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr || new Error("GATT connect failed");
}

async function writeCmd(cmdChar, data) {
  // Prefer without-response (lighter); fall back to write
  try {
    if (cmdChar.properties.writeWithoutResponse) {
      await cmdChar.writeValueWithoutResponse(data);
      return;
    }
  } catch (_) {}
  if (typeof cmdChar.writeValueWithResponse === "function") {
    await cmdChar.writeValueWithResponse(data);
    return;
  }
  await cmdChar.writeValue(data);
}

export async function connectArduino(handlers = {}) {
  if (!bleSupported()) {
    throw new Error("Use Google Chrome (Web Bluetooth).");
  }

  const device = await pickDevice();
  if (!device.gatt) throw new Error("No GATT");

  await connectGatt(device);

  // Important: do not hammer the radio right after connect
  await new Promise((r) => setTimeout(r, 800));

  if (!device.gatt.connected) {
    await connectGatt(device);
    await new Promise((r) => setTimeout(r, 500));
  }

  const service = await device.gatt.getPrimaryService(BLE_SERVICE);
  const cmdChar = await service.getCharacteristic(BLE_CMD);
  const statusChar = await service.getCharacteristic(BLE_STATUS);

  // temp is optional (read-only on new sketch)
  let tempChar = null;
  try {
    tempChar = await service.getCharacteristic(BLE_TEMP);
  } catch (_) {}

  let alive = true;
  const onGattDisconnected = () => {
    alive = false;
    if (handlers.onDisconnect) handlers.onDisconnect();
  };
  device.addEventListener("gattserverdisconnected", onGattDisconnected);

  const emitHeat = (raw) => {
    const e = clampHeat(raw);
    if (e == null) return;
    if (handlers.onExtraHeat) handlers.onExtraHeat(e);
  };

  const handleStatus = (value) => {
    const text = bytesToText(value);
    if (!text) return;
    if (handlers.onStatus) handlers.onStatus(text);
    const parsed = parseStatusText(text);
    if (parsed.extraHeat != null) emitHeat(parsed.extraHeat);
  };

  const onStatus = (event) => handleStatus(event.target.value);

  // Only ONE notification subscription — status carries pot E=
  try {
    await statusChar.startNotifications();
    statusChar.addEventListener("characteristicvaluechanged", onStatus);
  } catch (_) {}

  await new Promise((r) => setTimeout(r, 300));

  try {
    handleStatus(await statusChar.readValue());
  } catch (_) {}

  // Slow poll backup (1 Hz) — do not fight the radio
  const pollTimer = setInterval(async () => {
    if (!alive || !device.gatt?.connected) return;
    try {
      handleStatus(await statusChar.readValue());
    } catch (_) {}
  }, 1000);

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
    if (!(await ensureConnected())) throw new Error("Not connected");
    // small gap so we don't write during notify windows
    await new Promise((r) => setTimeout(r, 30));
    const nn = clampLevel(n);
    const mm = clampLevel(m);
    const cc = clampLevel(c);
    const hh = clampLevel(h);
    const text = `${nn},${mm},${cc},${hh}`;
    const data = new TextEncoder().encode(text);
    await writeCmd(cmdChar, data);
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
    alive = false;
    clearInterval(pollTimer);
    try {
      statusChar.removeEventListener("characteristicvaluechanged", onStatus);
    } catch (_) {}
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
      return device.name || "G9";
    }
  };
}
