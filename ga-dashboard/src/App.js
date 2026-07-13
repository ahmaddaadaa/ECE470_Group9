import { useEffect, useRef, useState } from "react";
import "./styles/App.css";

import Header from "./components/Header";
import TemperatureChart from "./components/TemperatureChart";
import PlanTable from "./components/PlanTable";
import ResultsSummary from "./components/ResultsSummary";
import BluetoothPanel from "./components/BluetoothPanel";

import { createRandomScenario } from "./ga/scenario";
import { runGA } from "./ga/gaEngine";
import { playLive } from "./ga/realtime";
import { bleSupported, connectArduino } from "./ble/arduinoBle";

const CHART_WINDOW = 16;

export default function App() {
  const [D, setD] = useState(1.25);
  const [pack, setPack] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState(
    "Apply Disturbance, then Run Optimization — red = no control, green = GA recovery."
  );
  const [stepLog, setStepLog] = useState([]);
  const [chartPoints, setChartPoints] = useState([]);
  const [ranked, setRanked] = useState(null);
  const [rankStep, setRankStep] = useState(null);
  const [resume, setResume] = useState(null);
  const [inject, setInject] = useState(0.8);
  const [sticky, setSticky] = useState(false);
  const [queue, setQueue] = useState({ nextStep: 0, queuedHeat: null });
  const player = useRef(null);

  const bleRef = useRef(null);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleName, setBleName] = useState("");
  const [bleStatus, setBleStatus] = useState("");
  const [boardTemp, setBoardTemp] = useState(null);
  const [bleAutoSend, setBleAutoSend] = useState(true);
  const bleAutoSendRef = useRef(true);

  useEffect(() => {
    bleAutoSendRef.current = bleAutoSend;
  }, [bleAutoSend]);

  useEffect(
    () => () => {
      if (player.current) player.current.cancel();
      if (bleRef.current) {
        try {
          bleRef.current.disconnect();
        } catch (_) {
          /* ignore */
        }
        bleRef.current = null;
      }
    },
    []
  );

  const sendActionToBoard = async (action, note) => {
    if (!bleRef.current?.connected || !action) return;
    try {
      const sent = await bleRef.current.sendFromAction(action);
      if (sent) {
        setBleStatus(
          `Sent ${sent.text}${note ? ` (${note})` : ""}`
        );
      }
    } catch (e) {
      setBleStatus(`Send failed: ${e.message}`);
    }
  };

  const onBleConnect = async () => {
    try {
      setBleStatus("Requesting device…");
      const client = await connectArduino({
        onStatus: (s) => setBleStatus(s),
        onTemperature: (t) => setBoardTemp(t),
        onDisconnect: () => {
          bleRef.current = null;
          setBleConnected(false);
          setBleName("");
          setBleStatus("Disconnected");
        }
      });
      bleRef.current = client;
      setBleConnected(true);
      setBleName(client.name);
      setBleStatus("Connected");
      setStatus("Arduino MKR WIFI 1010 connected over BLE.");
    } catch (e) {
      setBleStatus(e.message || "Connect cancelled");
    }
  };

  const onBleDisconnect = () => {
    if (bleRef.current) {
      bleRef.current.disconnect();
      bleRef.current = null;
    }
    setBleConnected(false);
    setBleName("");
    setBoardTemp(null);
    setBleStatus("Disconnected");
  };

  const onBleSendLatest = () => {
    const latest =
      stepLog.length > 0
        ? [...stepLog].sort((a, b) => Number(b.t) - Number(a.t))[0]
        : null;
    const action = latest?.applied || latest?.command || ranked?.[0];
    if (!action) {
      setBleStatus("No chromosome yet — run optimization first.");
      return;
    }
    sendActionToBoard(
      {
        n: action.nutrients ?? action.n,
        m: action.mixing ?? action.m,
        c: action.cooling ?? action.c,
        h: action.heating ?? action.h
      },
      "manual"
    );
  };

  const stopLive = () => {
    if (player.current) {
      if (player.current.getContinuous) {
        setResume(player.current.getContinuous());
      }
      player.current.cancel();
      player.current = null;
    }
    setPlaying(false);
  };

  const clearHistory = () => {
    setStepLog([]);
    setChartPoints([]);
    setRanked(null);
    setRankStep(null);
    setResume(null);
  };

  const onDisturb = () => {
    stopLive();
    const p = createRandomScenario(Number(D));
    setPack(p);
    setResult(null);
    clearHistory();
    // Show uncontrolled path briefly as starting context (same single-line style)
    setChartPoints(p.baselinePoints);
    setQueue({ nextStep: 0, queuedHeat: null });
    setStatus(
      `Disturbance ready (T0=${p.scenario.T0} C). Without control max ~${p.baselineMaxTemp} C. Run Optimization to recover.`
    );
  };

  const onOptimize = () => {
    if (!pack) {
      setStatus("Apply a disturbance first.");
      return;
    }
    stopLive();
    setBusy(true);
    setStatus("GA recovering temperature into safe band...");
    setTimeout(() => {
      try {
        const r = runGA(pack.scenario);
        setResult(r);
        setStepLog(r.bestChromosome.actions);
        setChartPoints(r.trajectories.dual || []);
        setRanked(r.rankedChromosomes);
        setRankStep(r.meta?.rankingStep ?? null);
        setResume(r.resume);
        setStatus(
          `Dual curves ready. Green max=${r.statistics.maxTemperature} C · in band ${(
            r.statistics.pctInRange * 100
          ).toFixed(0)}%. Red no-control max=${r.statistics.baselineMaxT} C.`
        );
        const actions = r.bestChromosome?.actions || [];
        const last = actions[actions.length - 1];
        if (last && bleAutoSendRef.current) {
          sendActionToBoard(last.applied || last.command, "optimize");
        }
      } catch (e) {
        setStatus(`Error: ${e.message}`);
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const startLive = (fromResume) => {
    if (!pack) {
      setStatus("Apply a disturbance first.");
      return;
    }
    stopLive();
    setPlaying(true);

    const seed = fromResume || resume || result?.resume || null;
    if (seed?.log?.length) {
      setStepLog(seed.log);
      const open = seed.openTemps || seed.temps || [];
      const ga = seed.temps || [];
      setChartPoints(
        Array.from({ length: Math.max(open.length, ga.length) }, (_, i) => ({
          time: i,
          baseline: open[i] ?? pack.scenario.T0,
          optimized: ga[i] ?? pack.scenario.T0
        }))
      );
      if (seed.ranked) setRanked(seed.ranked);
      if (seed.rankingStep != null) setRankStep(seed.rankingStep);
    } else if (!seed) {
      setStepLog([]);
      setChartPoints([
        {
          time: 0,
          baseline: pack.scenario.T0,
          optimized: pack.scenario.T0
        }
      ]);
    }

    setStatus("Live: red = no control, green = GA recovery each second.");

    player.current = playLive(pack.scenario, null, {
      delayMs: 1000,
      resume: seed,
      onStep: (s) => {
        setChartPoints(s.points);
        setStepLog(s.log);
        if (s.ranked?.length) {
          setRanked(s.ranked);
          setRankStep(s.rankingStep);
        }
        if (s.continuous) setResume(s.continuous);
        setStatus(s.status);
        if (bleAutoSendRef.current && s.log?.length) {
          const row = s.log[s.log.length - 1];
          sendActionToBoard(row.applied || row.command, `step ${row.t}`);
        }
      },
      onQueue: (q) => setQueue({ nextStep: q.nextStep, queuedHeat: q.queuedHeat }),
      onDone: (s) => {
        player.current = null;
        setPlaying(false);
        setChartPoints(s.points);
        setStepLog(s.log);
        if (s.continuous) setResume(s.continuous);
        setStatus(`Stopped at step ${s.steps}.`);
      }
    });
  };

  const onLive = () => {
    if (!pack) {
      setStatus("Apply a disturbance first.");
      return;
    }
    startLive(resume || result?.resume || null);
  };

  const onQueueInject = () => {
    if (!player.current || !playing) return;
    const info = player.current.queueNextDisturbance(Number(inject), { sticky });
    setQueue({ nextStep: info.nextStep, queuedHeat: info.queuedHeat });
    const s = `${Number(inject) >= 0 ? "+" : ""}${Number(inject).toFixed(1)} C`;
    setStatus(
      sticky
        ? `Extra heat ${s} every step from ${info.nextStep}.`
        : `Extra heat ${s} queued for step ${info.nextStep}.`
    );
  };

  const onReset = () => {
    stopLive();
    setPack(null);
    setResult(null);
    clearHistory();
    setQueue({ nextStep: 0, queuedHeat: null });
    setSticky(false);
    setStatus("Reset complete.");
  };

  const chartWin = chartPoints.slice(-CHART_WINDOW);
  const hasDual =
    chartPoints.some((p) => p.baseline != null && p.optimized != null) ||
    stepLog.length > 0;
  const chartMode = result || stepLog.length ? "opt" : pack ? "base" : "idle";

  const latestRow =
    stepLog.length > 0
      ? [...stepLog].sort((a, b) => Number(b.t) - Number(a.t))[0]
      : null;
  const latestFitness =
    latestRow?.stepFitness ??
    ranked?.[0]?.fitness ??
    result?.fitness?.aggregate ??
    null;
  const latestCost =
    latestRow?.stepCost ?? ranked?.[0]?.cost ?? null;
  const planCost = stepLog.length
    ? stepLog.reduce((s, r) => s + (Number(r.stepCost) || 0), 0)
    : result?.statistics?.controlCost ?? null;
  const stepIndex =
    rankStep != null
      ? rankStep
      : latestRow != null
        ? latestRow.t
        : null;

  const optTemps = stepLog
    .map((r) => r.optimizedT ?? r.temperature)
    .filter((t) => t != null && Number.isFinite(Number(t)))
    .map(Number);
  const liveStats =
    optTemps.length > 0
      ? {
          pctInRange:
            optTemps.filter((t) => t >= 35 && t <= 39).length / optTemps.length,
          maxTemperature: Math.round(Math.max(...optTemps) * 1000) / 1000,
          minTemperature: Math.round(Math.min(...optTemps) * 1000) / 1000
        }
      : result?.statistics || null;

  const showStats =
    latestFitness != null ||
    latestCost != null ||
    planCost != null ||
    liveStats != null;

  return (
    <div className="app">
      <div className="top-block">
        <Header />

        <div className="toolbar">
          <label>
            Disturbance
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.05"
              value={D}
              disabled={busy || playing}
              onChange={(e) => setD(e.target.value)}
            />
            <span>{Number(D).toFixed(2)}</span>
          </label>

          <button type="button" disabled={busy || playing} onClick={onDisturb}>
            Apply Disturbance
          </button>
          <button
            type="button"
            disabled={busy || playing || !pack}
            onClick={onOptimize}
          >
            {busy ? "Running..." : "Run Optimization"}
          </button>
          <button type="button" disabled={!pack || busy || playing} onClick={onLive}>
            Watch Live
          </button>
          {playing && (
            <button type="button" onClick={stopLive}>
              Stop
            </button>
          )}
          <button type="button" disabled={busy} onClick={onReset}>
            Reset
          </button>

          {playing && (
            <>
              <span className="toolbar-sep" />
              <label>
                Extra heat
                <input
                  type="range"
                  min="-2.5"
                  max="2.5"
                  step="0.1"
                  value={inject}
                  onChange={(e) => setInject(e.target.value)}
                />
                <span>
                  {Number(inject) >= 0 ? "+" : ""}
                  {Number(inject).toFixed(1)}
                </span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={sticky}
                  onChange={(e) => {
                    setSticky(e.target.checked);
                    if (player.current) player.current.setSticky(e.target.checked);
                  }}
                />
                Repeat
              </label>
              <button type="button" onClick={onQueueInject}>
                Queue
              </button>
              <button
                type="button"
                disabled={queue.queuedHeat == null}
                onClick={() => {
                  if (player.current) player.current.clearQueue();
                  setQueue({ nextStep: queue.nextStep, queuedHeat: null });
                  setSticky(false);
                }}
              >
                Clear
              </button>
            </>
          )}
        </div>

        <p className="status">{status}</p>

        <BluetoothPanel
          supported={bleSupported()}
          connected={bleConnected}
          deviceName={bleName}
          status={bleStatus}
          boardTemp={boardTemp}
          autoSend={bleAutoSend}
          onAutoSendChange={setBleAutoSend}
          onConnect={onBleConnect}
          onDisconnect={onBleDisconnect}
          onSendLatest={onBleSendLatest}
          busy={busy}
        />
      </div>

      <div className="main-block">
        <div className="upper-row">
          {hasDual ? (
            <TemperatureChart data={chartWin} dualLive showBoth mode={chartMode} />
          ) : (
            <TemperatureChart
              baseline={pack?.baselinePoints || []}
              mode={chartMode}
            />
          )}

          {showStats && (
            <ResultsSummary
              latestFitness={latestFitness}
              latestCost={latestCost}
              planCost={planCost}
              stepIndex={stepIndex}
              statistics={liveStats}
              peakBefore={pack?.baselineMaxTemp}
            />
          )}
        </div>

        {(stepLog.length > 0 || ranked?.length > 0) && (
          <PlanTable
            actions={stepLog}
            ranked={ranked}
            rankingStep={rankStep}
            newestFirst
          />
        )}
      </div>
    </div>
  );
}
