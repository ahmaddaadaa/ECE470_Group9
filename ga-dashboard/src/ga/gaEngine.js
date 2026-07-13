// Genetic algorithm for one 12-bit control decision per time step.

import {
  diverseSeedPopulation,
  decodeAction,
  encodeAction,
  formatBits,
  formatChromosome,
  crossover,
  mutate,
  randomBits,
  CHROMOSOME_BITS
} from "./chromosome";
import {
  applyStep,
  simulate,
  toPoints,
  zeroSchedule,
  zeroAction,
  heatAt,
  TARGET,
  SAFE_LOW,
  SAFE_HIGH,
  HORIZON
} from "./model";

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

export function stepFitness(Tnext, cost, Tnow, heat) {
  const err = Math.abs(Tnext - TARGET);
  const inBand = Tnext >= SAFE_LOW && Tnext <= SAFE_HIGH ? 1 : 0;
  let out = 0;
  if (Tnext > SAFE_HIGH) out = (Tnext - SAFE_HIGH) ** 2;
  if (Tnext < SAFE_LOW) out = (SAFE_LOW - Tnext) ** 2;

  const Tidle = Tnow + heat;
  const idleErr = Math.abs(Tidle - TARGET);
  let idleOut = 0;
  if (Tidle > SAFE_HIGH) idleOut = (Tidle - SAFE_HIGH) ** 2;
  if (Tidle < SAFE_LOW) idleOut = (SAFE_LOW - Tidle) ** 2;

  const far = Math.abs(Tnow - TARGET) > 0.8 || Math.abs(heat) > 0.4 || !inBand;
  const quality = 70 * inBand - 28 * err - 45 * out;
  const improvement = 25 * (idleErr - err) + 20 * (idleOut - out);
  const toward = 18 * (Math.abs(Tnow - TARGET) - err);
  const costPen = far ? 0.08 * cost : 0.35 * cost;
  const unsafe = Tnext < 31 || Tnext > 46 ? 120 : 0;

  return quality + improvement + toward - costPen - unsafe;
}

function evaluateOne(bits, Tnow, heat) {
  const action = decodeAction(bits);
  const out = applyStep(Tnow, action, heat);
  const fit = stepFitness(out.T, out.stepCost, Tnow, heat);
  return {
    fit,
    bits,
    action,
    Tnext: out.T,
    controlDelta: out.controlDelta,
    stepCost: out.stepCost
  };
}

function pickParent(pop, fits) {
  let best = Math.floor(Math.random() * pop.length);
  for (let i = 0; i < 3; i += 1) {
    const j = Math.floor(Math.random() * pop.length);
    if (fits[j] > fits[best]) best = j;
  }
  return pop[best].slice();
}

function rankTopK(evals, topK) {
  const sorted = [...evals].sort((a, b) =>
    b.fit !== a.fit ? b.fit - a.fit : a.stepCost - b.stepCost
  );
  const ranked = [];
  const seen = new Set();
  for (const e of sorted) {
    const key = formatChromosome(e.bits);
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push({
      rank: ranked.length + 1,
      fitness: round3(e.fit),
      cost: round3(e.stepCost),
      temperature: round3(e.Tnext),
      nextT: round3(e.Tnext),
      controlDelta: round3(e.controlDelta),
      n: e.action.n,
      m: e.action.m,
      c: e.action.c,
      h: e.action.h,
      bits: key,
      isBest: ranked.length === 0
    });
    if (ranked.length >= topK) break;
  }
  return ranked;
}

/**
 * Search best 12-bit chromosome for this step.
 * Seeds + mutation keep all levels 0–7 in play.
 */
export function runGAOneStep(Tnow, heat, opts = {}) {
  const popSize = opts.populationSize || 64;
  const gens = opts.generations || 45;
  const mutRate = opts.mutationRate || 0.3;
  const elites = opts.eliteCount || 2;
  const immigrants = 6;
  const topK = opts.topK || 12;

  let pop = diverseSeedPopulation(popSize);
  const catalog = new Map();

  const catalogPush = (evals) => {
    evals.forEach((e) => {
      const key = formatChromosome(e.bits);
      const prev = catalog.get(key);
      if (
        !prev ||
        e.fit > prev.fit ||
        (e.fit === prev.fit && e.stepCost < prev.stepCost)
      ) {
        catalog.set(key, e);
      }
    });
  };

  for (let gen = 0; gen < gens; gen += 1) {
    const evals = pop.map((b) => evaluateOne(b, Tnow, heat));
    const fits = evals.map((e) => e.fit);
    catalogPush(evals);

    const order = fits.map((f, i) => i).sort((a, b) => fits[b] - fits[a]);
    const next = order.slice(0, elites).map((i) => pop[i].slice());
    const rate = gen < gens * 0.55 ? mutRate : mutRate * 0.75;

    while (next.length < popSize - immigrants) {
      const [c1, c2] = crossover(pickParent(pop, fits), pickParent(pop, fits));
      next.push(mutate(c1, rate));
      if (next.length < popSize - immigrants) next.push(mutate(c2, rate));
    }
    // Fresh random + full-level seeds keep 000…111 present
    while (next.length < popSize) {
      next.push(Math.random() < 0.5 ? randomBits() : diverseSeedPopulation(1)[0]);
    }
    pop = next;
  }

  catalogPush(pop.map((b) => evaluateOne(b, Tnow, heat)));
  catalogPush(diverseSeedPopulation(48).map((b) => evaluateOne(b, Tnow, heat)));

  const ranked = rankTopK([...catalog.values()], topK);
  const top = ranked[0];
  const bestAction = top
    ? { n: top.n, m: top.m, c: top.c, h: top.h }
    : { n: 0, m: 0, c: 0, h: 0 };

  return {
    bestAction,
    bestBits: encodeAction(bestAction),
    fitness: top ? top.fitness : 0,
    nextT: top ? top.nextT : round3(Tnow),
    controlDelta: top ? top.controlDelta : 0,
    stepCost: top ? top.cost : 0,
    chromosomeBits: CHROMOSOME_BITS,
    ranked
  };
}

/**
 * Dual trajectories from the same disturbance:
 *   red  = original (no control)
 *   green = GA-optimized recovery into the safe band
 * Table keeps one fixed temperature value per curve per step.
 */
export function runGA(scenario, opts = {}) {
  const steps = opts.horizon || HORIZON;
  const openSim = simulate(zeroSchedule(steps), scenario);
  const openTemps = openSim.temps;

  let T = scenario.T0;
  let Topen = scenario.T0;
  const schedule = [];
  const actions = [];
  const temps = [T];
  const openChain = [Topen];
  let totalCost = 0;
  let lastFit = 0;
  let lastRanked = [];
  let rankAt = { T: scenario.T0, heat: 0, t: 0, abs: -1 };

  for (let t = 0; t < steps; t += 1) {
    const heat = heatAt(scenario, t);
    const ga = runGAOneStep(T, heat, { ...opts, topK: 12 });
    const action = ga.bestAction;
    schedule.push(action);
    lastRanked = ga.ranked || [];
    lastFit = ga.fitness;

    if (Math.abs(heat) > rankAt.abs) {
      rankAt = { T, heat, t, abs: Math.abs(heat) };
    }

    // Red: same heat, no control
    const open = applyStep(Topen, zeroAction(), heat);
    Topen = open.T;
    openChain.push(Topen);

    // Green: best chromosome this step
    const closed = applyStep(T, action, heat);
    T = closed.T;
    temps.push(T);
    totalCost += closed.stepCost;

    actions.push({
      t,
      originalT: round3(Topen),
      optimizedT: round3(T),
      temperature: round3(T),
      controlDelta: round3(closed.controlDelta),
      heat: round3(heat),
      command: {
        nutrients: action.n,
        mixing: action.m,
        cooling: action.c,
        heating: action.h,
        bits: formatBits(action.n, action.m, action.c, action.h)
      },
      applied: {
        nutrients: closed.applied.n,
        mixing: closed.applied.m,
        cooling: closed.applied.c,
        heating: closed.applied.h
      },
      stepCost: round3(closed.stepCost),
      stepFitness: ga.fitness
    });
  }

  const showcase = runGAOneStep(rankAt.T, rankAt.heat, {
    ...opts,
    populationSize: 72,
    generations: 50,
    topK: 12
  });

  const ranked = (showcase.ranked.length ? showcase.ranked : lastRanked).map(
    (r) => ({
      ...r,
      temperature: r.temperature ?? r.nextT
    })
  );

  const inRange =
    temps.filter((x) => x >= SAFE_LOW && x <= SAFE_HIGH).length / temps.length;
  const meanAbs =
    temps.reduce((s, x) => s + Math.abs(x - TARGET), 0) / temps.length;

  const dual = openChain.map((baseline, i) => ({
    time: i,
    baseline: round3(baseline),
    optimized: round3(temps[i])
  }));

  return {
    meta: {
      scenarioId: scenario.id,
      disturbanceScale: scenario.disturbanceScale,
      population: opts.populationSize || 64,
      generations: opts.generations || 45,
      horizon: steps,
      chromosomeBits: CHROMOSOME_BITS,
      design: "dual curves: red no-control, green GA recovery",
      rankingStep: rankAt.t
    },
    bestChromosome: { actions },
    rankedChromosomes: ranked,
    fitness: {
      aggregate: round3(lastFit),
      breakdown: {
        note: "Green recovers to 35–39 C; red shows same disturbance without control.",
        rankingStep: rankAt.t,
        lastStepFitness: round3(lastFit),
        exampleChromosome: ranked[0]?.bits
      }
    },
    statistics: {
      maxTemperature: round3(Math.max(...temps)),
      minTemperature: round3(Math.min(...temps)),
      pctInRange: round3(inRange),
      meanAbsErrorFrom37: round3(meanAbs),
      controlCost: round3(totalCost),
      baselineMaxT: round3(Math.max(...openTemps)),
      baselineInRange: round3(
        openTemps.filter((x) => x >= SAFE_LOW && x <= SAFE_HIGH).length /
          openTemps.length
      )
    },
    trajectories: {
      optimized: toPoints(temps),
      baseline: toPoints(openChain),
      dual
    },
    schedule,
    resume: {
      t: steps,
      T,
      Topen,
      temps: [...temps],
      openTemps: [...openChain],
      log: actions,
      ranked,
      rankingStep: rankAt.t
    }
  };
}
