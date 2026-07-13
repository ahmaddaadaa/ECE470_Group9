// Live mode: advance red (no control) and green (GA) one step per second.

import {
  applyStep,
  zeroAction,
  heatAt,
  TARGET,
  SAFE_LOW,
  SAFE_HIGH
} from "./model";
import { formatBits } from "./chromosome";
import { runGAOneStep } from "./gaEngine";

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

export function playLive(scenario, _schedule, opts = {}) {
  const {
    delayMs = 1000,
    onStep,
    onDone,
    onQueue,
    resume = null,
    gaOpts = { populationSize: 48, generations: 32, topK: 12 }
  } = opts;

  let queued = null;
  let sticky = false;
  let stop = false;

  let t = resume?.t ?? 0;
  let T = resume?.T ?? scenario.T0;
  let Topen = resume?.Topen ?? scenario.T0;
  const temps = resume?.temps ? [...resume.temps] : [scenario.T0];
  const openTemps = resume?.openTemps
    ? [...resume.openTemps]
    : [scenario.T0];
  const log = resume?.log ? [...resume.log] : [];

  const points = () => {
    const n = Math.max(temps.length, openTemps.length);
    return Array.from({ length: n }, (_, i) => ({
      time: i,
      baseline: round3(openTemps[i] ?? openTemps[openTemps.length - 1]),
      optimized: round3(temps[i] ?? temps[temps.length - 1])
    }));
  };

  const emitQueue = () =>
    onQueue && onQueue({ nextStep: t, queuedHeat: queued, sticky });

  onStep &&
    onStep({
      points: points(),
      log: [...log],
      ranked: resume?.ranked || null,
      rankingStep: resume?.rankingStep ?? null,
      continuous: {
        t,
        T,
        Topen,
        temps: [...temps],
        openTemps: [...openTemps],
        log: [...log]
      },
      status: `Live · red (no control) vs green (GA) · target ${TARGET} C`
    });
  emitQueue();

  function tick() {
    if (stop) {
      onDone &&
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
      return;
    }

    const base = heatAt(scenario, t);
    const inject = queued != null && Number.isFinite(queued) ? Number(queued) : 0;
    const heat = base + inject;
    if (!sticky) queued = null;
    emitQueue();

    const ga = runGAOneStep(T, heat, gaOpts);
    const cmd = ga.bestAction;

    const openOut = applyStep(Topen, zeroAction(), heat);
    const gaOut = applyStep(T, cmd, heat);
    Topen = openOut.T;
    T = gaOut.T;
    openTemps.push(Topen);
    temps.push(T);

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
      stepCost: round3(gaOut.stepCost),
      injectedDisturbance: round3(inject),
      stepFitness: ga.fitness
    });

    const band =
      T >= SAFE_LOW && T <= SAFE_HIGH ? "IN safe band" : "outside safe band";

    const ranked = (ga.ranked || []).map((r) => ({
      ...r,
      temperature: r.temperature ?? r.nextT
    }));

    onStep &&
      onStep({
        points: points(),
        log: [...log],
        ranked,
        rankingStep: t,
        continuous: {
          t: t + 1,
          T,
          Topen,
          temps: [...temps],
          openTemps: [...openTemps],
          log: [...log],
          ranked,
          rankingStep: t
        },
        status: `t=${t}s · red ${Topen.toFixed(2)} C · green ${T.toFixed(2)} C · ${formatBits(cmd.n, cmd.m, cmd.c, cmd.h)} · ${band}`
      });

    t += 1;
    setTimeout(tick, delayMs);
  }

  setTimeout(tick, delayMs);

  return {
    cancel: () => {
      stop = true;
    },
    queueNextDisturbance: (v, o = {}) => {
      queued = Number(v);
      if (o.sticky != null) sticky = !!o.sticky;
      emitQueue();
      return { nextStep: t, queuedHeat: queued, sticky };
    },
    setSticky: (v) => {
      sticky = !!v;
      emitQueue();
    },
    clearQueue: () => {
      queued = null;
      sticky = false;
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
