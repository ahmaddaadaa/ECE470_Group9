import {
  applyStep,
  zeroAction,
  heatAt,
  stepCost,
  TARGET
} from "./model";
import { formatBits } from "./chromosome";
import { runGAOneStep } from "./gaEngine";

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

export function playLive(scenario, opts = {}) {
  const {
    delayMs = 1000,
    onStep,
    onDone,
    onQueue,
    resume = null,
    getExtraHeat = null,
    gaOpts = { populationSize: 48, generations: 32, topK: 12 }
  } = opts;

  let queued = null;
  let stop = false;

  let t = resume?.t ?? 0;
  let T = resume?.T ?? scenario.T0;
  let Topen = resume?.Topen ?? scenario.T0;
  const temps = resume?.temps ? [...resume.temps] : [scenario.T0];
  const openTemps = resume?.openTemps
    ? [...resume.openTemps]
    : [scenario.T0];
  const log = resume?.log ? [...resume.log] : [];

  let lastCmd = null;
  let lastRanked = resume?.ranked || null;
  let lastFitness = null;
  let lastHeatForGa = null;
  let lastTForGa = null;

  const points = () => {
    const n = Math.max(temps.length, openTemps.length);
    return Array.from({ length: n }, (_, i) => ({
      time: i,
      baseline: round3(openTemps[i] ?? openTemps[openTemps.length - 1]),
      optimized: round3(temps[i] ?? temps[temps.length - 1])
    }));
  };

  const emitQueue = () =>
    onQueue && onQueue({ nextStep: t, queuedHeat: queued });

  if (onStep) {
    onStep({
      points: points(),
      log: [...log],
      ranked: lastRanked,
      rankingStep: resume?.rankingStep ?? null,
      continuous: {
        t,
        T,
        Topen,
        temps: [...temps],
        openTemps: [...openTemps],
        log: [...log]
      }
    });
  }
  emitQueue();

  function isStable(Tnow, heat) {
    return (
      lastCmd != null &&
      Math.abs(Tnow - TARGET) < 0.35 &&
      Math.abs(heat) < 0.35 &&
      lastTForGa != null &&
      Math.abs(Tnow - lastTForGa) < 0.25 &&
      lastHeatForGa != null &&
      Math.abs(heat - lastHeatForGa) < 0.2
    );
  }

  function tick() {
    if (stop) {
      if (onDone) {
        onDone({
          points: points(),
          log: [...log],
          steps: t,
          continuous: {
            t,
            T,
            Topen,
            temps: [...temps],
            openTemps: [...openTemps],
            log: [...log]
          }
        });
      }
      return;
    }

    const base = heatAt(scenario, t);
    let extra = 0;
    if (typeof getExtraHeat === "function") {
      const e = Number(getExtraHeat());
      if (Number.isFinite(e)) extra = e;
    }
    const queuedHeat =
      queued != null && Number.isFinite(queued) ? Number(queued) : 0;
    const inject = extra + queuedHeat;
    const heat = base + inject;
    queued = null;
    emitQueue();

    let cmd;
    let fitness;
    let ranked;
    let reused = false;

    if (isStable(T, heat)) {
      cmd = lastCmd;
      fitness = lastFitness;
      ranked = lastRanked;
      reused = true;
    } else {
      const ga = runGAOneStep(T, heat, gaOpts);
      cmd = ga.bestAction;
      fitness = ga.fitness;
      ranked = (ga.ranked || []).map((r) => ({
        ...r,
        temperature: r.temperature ?? r.nextT
      }));
      lastCmd = cmd;
      lastFitness = fitness;
      lastRanked = ranked;
      lastHeatForGa = heat;
      lastTForGa = T;
    }

    const openOut = applyStep(Topen, zeroAction(), heat);
    const gaOut = applyStep(T, cmd, heat);
    Topen = openOut.T;
    T = gaOut.T;
    openTemps.push(Topen);
    temps.push(T);

    const cost = reused
      ? stepCost(cmd.n, cmd.m, cmd.c, cmd.h)
      : gaOut.stepCost;

    log.push({
      t,
      originalT: round3(Topen),
      optimizedT: round3(T),
      temperature: round3(T),
      controlDelta: round3(gaOut.controlDelta),
      heat: round3(heat),
      command: {
        nutrients: cmd.n,
        mixing: cmd.m,
        cooling: cmd.c,
        heating: cmd.h,
        bits: formatBits(cmd.n, cmd.m, cmd.c, cmd.h)
      },
      applied: {
        nutrients: gaOut.applied.n,
        mixing: gaOut.applied.m,
        cooling: gaOut.applied.c,
        heating: gaOut.applied.h
      },
      stepCost: round3(cost),
      injectedDisturbance: round3(inject),
      stepFitness: fitness,
      gaReused: reused
    });

    if (onStep) {
      onStep({
        points: points(),
        log: [...log],
        ranked: ranked || lastRanked,
        rankingStep: t,
        continuous: {
          t: t + 1,
          T,
          Topen,
          temps: [...temps],
          openTemps: [...openTemps],
          log: [...log],
          ranked: ranked || lastRanked,
          rankingStep: t
        }
      });
    }

    t += 1;
    setTimeout(tick, delayMs);
  }

  setTimeout(tick, delayMs);

  return {
    cancel: () => {
      stop = true;
    },
    queueNextDisturbance: (v) => {
      queued = Number(v);
      emitQueue();
      return { nextStep: t, queuedHeat: queued };
    },
    clearQueue: () => {
      queued = null;
      emitQueue();
    },
    getContinuous: () => ({
      t,
      T,
      Topen,
      temps: [...temps],
      openTemps: [...openTemps],
      log: [...log]
    })
  };
}
