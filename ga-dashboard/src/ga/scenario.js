import { HORIZON, zeroSchedule, simulate, toPoints } from "./model";

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function createRandomScenario(D = 1.2) {
  const T0 = Math.round(rand(36.8, 37.2) * 1000) / 1000;
  const peak = rand(1.3, 2.0);
  const shape = [0.2, 1.0, 1.5, 1.35, 1.0, 0.65, 0.35, 0.15, 0.05, 0];
  const disturbance = shape.map(
    (s) => Math.round(s * peak * rand(0.95, 1.05) * 1000) / 1000
  );
  const noise = Array.from(
    { length: HORIZON },
    () => Math.round((Math.random() - 0.5) * 0.06 * 1000) / 1000
  );

  const scenario = {
    id: `run_${Date.now().toString(36)}`,
    T0,
    disturbance,
    noise,
    disturbanceScale: Number(D)
  };

  const { temps } = simulate(zeroSchedule(HORIZON), scenario);
  return {
    scenario,
    baselinePoints: toPoints(temps),
    baselineMaxTemp: Math.round(Math.max(...temps) * 1000) / 1000,
    baselineMinTemp: Math.round(Math.min(...temps) * 1000) / 1000
  };
}
