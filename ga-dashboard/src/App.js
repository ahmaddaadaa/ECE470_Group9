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
  const [stepLog, setStepLog] = useState([]);
  const [chartPoints, setChartPoints] = useState([]);
  const [ranked, setRanked] = useState(null);
  const [rankStep, setRankStep] = useState(null);
  const [resume, setResume] = useState(null);
  const [inject, setInject] = useState(0.8);
  const [queue, setQueue] = useState({ nextStep: 0, queuedHeat: null });
  const player = useRef(null);

  const bleRef = useRef(null);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleNote, setBleNote] = useState("");
  // Default off: sending commands every second can drop weak BLE links
  const [bleAutoSend, setBleAutoSend] = useState(false);
  const [potLink, setPotLink] = useState(true);
  const bleAutoSendRef = useRef(true);
  const potLinkRef = useRef(true);
  const injectRef = useRef(Number(inject));
  const playingRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    bleAutoSendRef.current = bleAutoSend;
  }, [bleAutoSend]);
  useEffect(() => {
    potLinkRef.current = potLink;
  }, [potLink]);
  useEffect(() => {
    injectRef.current = Number(inject);
  }, [inject]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(
    () => () => {
      if (player.current) player.current.cancel();
      if (bleRef.current) {
        try {
          bleRef.current.disconnect();
        } catch (_) {}
        bleRef.current = null;
      }
    },
    []
  );

  const sendActionToBoard = async (action) => {
    if (!bleRef.current?.connected || !action) return;
    try {
      await bleRef.current.sendFromAction(action);
    } catch (_) {}
  };

  const clearHistory = () => {
    setStepLog([]);
    setChartPoints([]);
    setRanked(null);
    setRankStep(null);
    setResume(null);
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

  const onDisturb = () => {
    if (playingRef.current || busyRef.current) return;
    const strength = Number(D);
    if (!Number.isFinite(strength)) return;
    stopLive();
    const p = createRandomScenario(strength);
    setD(strength);
    setPack(p);
    setResult(null);
    clearHistory();
    setChartPoints(p.baselinePoints);
    setQueue({ nextStep: 0, queuedHeat: null });
  };

  const onPotExtraHeat = (e) => {
    if (!potLinkRef.current) return;
    const rounded = Math.round(Number(e) * 100) / 100;
    if (!Number.isFinite(rounded)) return;
    injectRef.current = rounded;
    setInject(rounded);
    setBleNote(
      `Pot extra heat ${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)} C`
    );
  };

  const onBleConnect = async () => {
    setBleNote("Pick G9 in the list…");
    try {
      const client = await connectArduino({
        onExtraHeat: onPotExtraHeat,
        onDisconnect: () => {
          bleRef.current = null;
          setBleConnected(false);
          setBleNote("Disconnected");
        }
      });
      bleRef.current = client;
      setBleConnected(true);
      setBleNote("Connected " + (client.name || "") + " — turn pot to test");
    } catch (e) {
      setBleConnected(false);
      const msg = e && e.message ? e.message : "Connect cancelled";
      setBleNote(msg);
    }
  };

  const onBleDisconnect = () => {
    if (bleRef.current) {
      bleRef.current.disconnect();
      bleRef.current = null;
    }
    setBleConnected(false);
    setBleNote("");
  };

  const onBleSendLatest = () => {
    const latest =
      stepLog.length > 0
        ? [...stepLog].sort((a, b) => Number(b.t) - Number(a.t))[0]
        : null;
    const action = latest?.applied || latest?.command || ranked?.[0];
    if (!action) return;
    sendActionToBoard({
      n: action.nutrients ?? action.n,
      m: action.mixing ?? action.m,
      c: action.cooling ?? action.c,
      h: action.heating ?? action.h
    });
  };

  const onOptimize = () => {
    if (!pack) return;
    stopLive();
    setBusy(true);
    setTimeout(() => {
      try {
        const r = runGA(pack.scenario);
        setResult(r);
        setStepLog(r.bestChromosome.actions);
        setChartPoints(r.trajectories.dual || []);
        setRanked(r.rankedChromosomes);
        setRankStep(r.meta?.rankingStep ?? null);
        setResume(r.resume);
        const actions = r.bestChromosome?.actions || [];
        const last = actions[actions.length - 1];
        if (last && bleAutoSendRef.current) {
          sendActionToBoard(last.applied || last.command);
        }
      } catch (_) {
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const startLive = (fromResume) => {
    if (!pack) return;
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

    player.current = playLive(pack.scenario, {
      delayMs: 1000,
      resume: seed,
      getExtraHeat: () => injectRef.current,
      onStep: (s) => {
        setChartPoints(s.points);
        setStepLog(s.log);
        if (s.ranked?.length) {
          setRanked(s.ranked);
          setRankStep(s.rankingStep);
        }
        if (s.continuous) setResume(s.continuous);
        if (bleAutoSendRef.current && s.log?.length) {
          const row = s.log[s.log.length - 1];
          sendActionToBoard(row.applied || row.command);
        }
      },
      onQueue: (q) => setQueue({ nextStep: q.nextStep, queuedHeat: q.queuedHeat }),
      onDone: (s) => {
        player.current = null;
        setPlaying(false);
        setChartPoints(s.points);
        setStepLog(s.log);
        if (s.continuous) setResume(s.continuous);
      }
    });
  };

  const onLive = () => {
    if (!pack) return;
    startLive(resume || result?.resume || null);
  };

  const onQueueInject = () => {
    if (!player.current || !playing) return;
    const info = player.current.queueNextDisturbance(Number(inject));
    setQueue({ nextStep: info.nextStep, queuedHeat: info.queuedHeat });
  };

  const onReset = () => {
    stopLive();
    setPack(null);
    setResult(null);
    clearHistory();
    setQueue({ nextStep: 0, queuedHeat: null });
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
  const latestCost = latestRow?.stepCost ?? ranked?.[0]?.cost ?? null;
  const planCost = stepLog.length
    ? stepLog.reduce((s, r) => s + (Number(r.stepCost) || 0), 0)
    : result?.statistics?.controlCost ?? null;
  const stepIndex =
    rankStep != null ? rankStep : latestRow != null ? latestRow.t : null;

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

          {(playing || bleConnected) && (
            <>
              <span className="toolbar-sep" />
              <label>
                Extra heat
                <input
                  type="range"
                  min="-2.5"
                  max="2.5"
                  step="0.05"
                  value={Number(inject)}
                  readOnly={bleConnected && potLink}
                  onChange={(e) => {
                    if (bleConnected && potLink) return;
                    const v = Number(e.target.value);
                    setInject(v);
                    injectRef.current = v;
                  }}
                />
                <span>
                  {Number(inject) >= 0 ? "+" : ""}
                  {Number(inject).toFixed(2)} C
                  {bleConnected && potLink ? " from pot" : ""}
                </span>
              </label>
              {playing && (
                <>
                  <button type="button" onClick={onQueueInject}>
                    Queue
                  </button>
                  <button
                    type="button"
                    disabled={queue.queuedHeat == null}
                    onClick={() => {
                      if (player.current) player.current.clearQueue();
                      setQueue({ nextStep: queue.nextStep, queuedHeat: null });
                    }}
                  >
                    Clear
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <BluetoothPanel
          supported={bleSupported()}
          connected={bleConnected}
          note={bleNote}
          autoSend={bleAutoSend}
          potLink={potLink}
          onAutoSendChange={setBleAutoSend}
          onPotLinkChange={setPotLink}
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
