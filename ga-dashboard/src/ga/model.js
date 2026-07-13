// Temperature plant: N,H raise T; M,C lower T. Levels 0-7.

export const HORIZON = 10;
export const TARGET = 37;
export const SAFE_LOW = 35;
export const SAFE_HIGH = 39;

// degrees C change per control level
export const WEIGHTS = {
  wN: 0.2,
  wM: 0.28,
  wC: 0.65,
  wH: 0.55
};

export const COST = { n: 0.3, m: 0.2, c: 0.7, h: 0.65, overlap: 1.0 };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function stepCost(n, m, c, h) {
  return (
    COST.n * n + COST.m * m + COST.c * c + COST.h * h + COST.overlap * Math.min(c, h)
  );
}

export function controlDelta(n, m, c, h) {
  return WEIGHTS.wN * n + WEIGHTS.wH * h - WEIGHTS.wC * c - WEIGHTS.wM * m;
}

export function applyStep(T, action, heat) {
  const n = clamp(action.n | 0, 0, 7);
  const m = clamp(action.m | 0, 0, 7);
  const c = clamp(action.c | 0, 0, 7);
  const h = clamp(action.h | 0, 0, 7);
  const dCtrl = controlDelta(n, m, c, h);
  const Tnext = T + dCtrl + heat;
  return {
    T: Tnext,
    applied: { n, m, c, h },
    controlDelta: dCtrl,
    stepCost: stepCost(n, m, c, h)
  };
}

export function zeroAction() {
  return { n: 0, m: 0, c: 0, h: 0 };
}

export function simulate(schedule, scenario) {
  const temps = [scenario.T0];
  const steps = [];
  let totalCost = 0;
  const nSteps = schedule?.length || HORIZON;

  for (let t = 0; t < nSteps; t += 1) {
    const cmd = schedule[t] || zeroAction();
    const heat = heatAt(scenario, t);
    const out = applyStep(temps[t], cmd, heat);
    totalCost += out.stepCost;
    temps.push(out.T);
    steps.push({
      t,
      command: { ...cmd },
      applied: out.applied,
      controlDelta: out.controlDelta,
      heat,
      stepCost: out.stepCost
    });
  }

  return { temps, steps, totalCost };
}

export function zeroSchedule(length = HORIZON) {
  return Array.from({ length }, () => zeroAction());
}

export function toPoints(temps) {
  return temps.map((temperature, time) => ({
    time,
    temperature: Math.round(temperature * 1000) / 1000
  }));
}

// Disturbance heat for step t (pulse over the horizon, then 0)
export function heatAt(scenario, t) {
  const scale = scenario.disturbanceScale || 0;
  const len = scenario.disturbance?.length || HORIZON;
  if (t >= 0 && t < len) {
    return scale * (scenario.disturbance[t] || 0) + (scenario.noise[t] || 0);
  }
  return 0;
}
