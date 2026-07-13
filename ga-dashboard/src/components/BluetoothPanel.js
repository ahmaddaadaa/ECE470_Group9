export default function BluetoothPanel({
  supported,
  connected,
  deviceName,
  status,
  boardTemp,
  autoSend,
  onAutoSendChange,
  onConnect,
  onDisconnect,
  onSendLatest,
  busy
}) {
  return (
    <div className="toolbar ble-toolbar">
      <span className="ble-label">Arduino BLE</span>
      {!supported && (
        <span className="queue-note">
          Web Bluetooth needs Chrome/Edge on localhost or HTTPS
        </span>
      )}
      {supported && !connected && (
        <button type="button" disabled={busy} onClick={onConnect}>
          Connect MKR WIFI 1010
        </button>
      )}
      {connected && (
        <>
          <span className="ble-connected">
            Connected{deviceName ? `: ${deviceName}` : ""}
          </span>
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
          <button type="button" onClick={onSendLatest} disabled={busy}>
            Send latest N/M/C/H
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => onAutoSendChange(e.target.checked)}
            />
            Auto-send on each step
          </label>
          {boardTemp != null && (
            <span className="queue-note">
              Board T: {Number(boardTemp).toFixed(2)} C
            </span>
          )}
        </>
      )}
      {status && <span className="queue-note ble-status">{status}</span>}
    </div>
  );
}
