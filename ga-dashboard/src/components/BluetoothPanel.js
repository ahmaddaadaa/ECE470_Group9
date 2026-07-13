export default function BluetoothPanel({
  supported,
  connected,
  autoSend,
  potLink,
  onAutoSendChange,
  onPotLinkChange,
  onConnect,
  onDisconnect,
  onSendLatest,
  busy
}) {
  return (
    <div className="toolbar ble-toolbar">
      <span className="ble-label">Hardware</span>
      {!supported && (
        <span className="queue-note">Use Chrome for Bluetooth</span>
      )}
      {supported && !connected && (
        <button type="button" disabled={busy} onClick={onConnect}>
          Connect board
        </button>
      )}
      {connected && (
        <>
          <span className="ble-connected">Connected</span>
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
          <button type="button" onClick={onSendLatest} disabled={busy}>
            Send levels
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => onAutoSendChange(e.target.checked)}
            />
            Auto send
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={potLink}
              onChange={(e) => onPotLinkChange(e.target.checked)}
            />
            Pot for extra heat
          </label>
        </>
      )}
    </div>
  );
}
