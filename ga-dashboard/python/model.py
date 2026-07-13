"""
Temperature plant model with simultaneous heating/cooling and slew rates.

ΔT = wN*N + wH*H - wC*C - wM*M + D*d + noise

Slew limits (applied levels cannot jump faster than S per step):
  Cooling: S_C = 3 (fast)
  Heating: S_H = 1 (slow)
  Nutrients / Mixing: S = 2
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

from chromosome import HORIZON, ActionStep, DecodedChromosome

# Fixed model weights (°C per level)
WEIGHTS = {
    "wN": 0.20,
    "wM": 0.12,
    "wC": 0.35,
    "wH": 0.30,
}

# Max |level change| per timestep
SLEW = {
    "nutrients": 2,
    "mixing": 2,
    "cooling": 3,  # faster
    "heating": 1,  # slower
}

# Cost per level (applied)
COST_RATES = {
    "nutrients": 0.50,
    "mixing": 0.40,
    "cooling": 1.00,
    "heating": 0.90,
}
OVERLAP_TAX_BETA = 0.50  # extra cost per min(C,H) level


def _slew_toward(current: int, target: int, max_step: int) -> int:
    delta = int(target) - int(current)
    if delta > max_step:
        delta = max_step
    elif delta < -max_step:
        delta = -max_step
    return int(np.clip(current + delta, 0, 7))


def apply_slew(
    commands: List[ActionStep],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[ActionStep]]:
    """Convert command levels to applied levels with per-actuator slew limits."""
    n_app = np.zeros(HORIZON, dtype=int)
    m_app = np.zeros(HORIZON, dtype=int)
    c_app = np.zeros(HORIZON, dtype=int)
    h_app = np.zeros(HORIZON, dtype=int)

    n_cur = m_cur = c_cur = h_cur = 0
    applied_steps: List[ActionStep] = []

    for t, cmd in enumerate(commands):
        n_cur = _slew_toward(n_cur, cmd.nutrients, SLEW["nutrients"])
        m_cur = _slew_toward(m_cur, cmd.mixing, SLEW["mixing"])
        c_cur = _slew_toward(c_cur, cmd.cooling, SLEW["cooling"])
        h_cur = _slew_toward(h_cur, cmd.heating, SLEW["heating"])

        n_app[t] = n_cur
        m_app[t] = m_cur
        c_app[t] = c_cur
        h_app[t] = h_cur

        step = ActionStep(
            t=t,
            nutrients=cmd.nutrients,
            mixing=cmd.mixing,
            cooling=cmd.cooling,
            heating=cmd.heating,
            nutrients_applied=n_cur,
            mixing_applied=m_cur,
            cooling_applied=c_cur,
            heating_applied=h_cur,
        )
        applied_steps.append(step)

    return (
        n_app.astype(float),
        m_app.astype(float),
        c_app.astype(float),
        h_app.astype(float),
        applied_steps,
    )


def step_cost(n: float, m: float, c: float, h: float) -> float:
    base = (
        COST_RATES["nutrients"] * n
        + COST_RATES["mixing"] * m
        + COST_RATES["cooling"] * c
        + COST_RATES["heating"] * h
    )
    overlap = OVERLAP_TAX_BETA * min(c, h)
    return float(base + overlap)


def total_cost(n, m, c, h) -> float:
    total = 0.0
    for t in range(len(n)):
        total += step_cost(n[t], m[t], c[t], h[t])
    return total


def simulate_temperature(
    nutrients: Sequence[float],
    mixing: Sequence[float],
    cooling: Sequence[float],
    heating: Sequence[float],
    t0: float,
    disturbance: Sequence[float],
    noise: Sequence[float],
    disturbance_scale: float = 1.0,
    weights: Optional[Dict[str, float]] = None,
) -> np.ndarray:
    """Returns temps length HORIZON+1 (includes T0)."""
    w = weights or WEIGHTS
    n = np.asarray(nutrients, dtype=float)
    m = np.asarray(mixing, dtype=float)
    c = np.asarray(cooling, dtype=float)
    h = np.asarray(heating, dtype=float)
    d = np.asarray(disturbance, dtype=float) * float(disturbance_scale)
    eps = np.asarray(noise, dtype=float)

    steps = len(n)
    temps = np.zeros(steps + 1)
    temps[0] = t0
    for t in range(steps):
        dT = (
            w["wN"] * n[t]
            + w["wH"] * h[t]
            - w["wC"] * c[t]
            - w["wM"] * m[t]
            + d[t]
            + eps[t]
        )
        temps[t + 1] = temps[t] + dT
    return temps


def simulate_from_chromosome(
    decoded: DecodedChromosome,
    t0: float,
    disturbance: Sequence[float],
    noise: Sequence[float],
    disturbance_scale: float = 1.0,
) -> Tuple[np.ndarray, List[ActionStep], float]:
    n, m, c, h, applied = apply_slew(decoded.commands)
    temps = simulate_temperature(
        nutrients=n,
        mixing=m,
        cooling=c,
        heating=h,
        t0=t0,
        disturbance=disturbance,
        noise=noise,
        disturbance_scale=disturbance_scale,
    )
    cost = total_cost(n, m, c, h)
    return temps, applied, cost


def baseline_open_loop(
    t0: float,
    disturbance: Sequence[float],
    noise: Sequence[float],
    disturbance_scale: float = 1.0,
) -> np.ndarray:
    z = np.zeros(HORIZON)
    return simulate_temperature(
        nutrients=z,
        mixing=z,
        cooling=z,
        heating=z,
        t0=t0,
        disturbance=disturbance,
        noise=noise,
        disturbance_scale=disturbance_scale,
    )


def full_trajectory_points(temps: np.ndarray) -> List[dict]:
    return [
        {"time": i, "temperature": round(float(temps[i]), 3)}
        for i in range(len(temps))
    ]


def actions_to_json(steps: List[ActionStep]) -> List[dict]:
    rows = []
    for s in steps:
        simultaneous = s.cooling_applied > 0 and s.heating_applied > 0
        bits = (
            f"[{s.nutrients:03b}, {s.mixing:03b}, "
            f"{s.cooling:03b}, {s.heating:03b}]"
        )
        rows.append(
            {
                "t": s.t,
                "command": {
                    "nutrients": s.nutrients,
                    "mixing": s.mixing,
                    "cooling": s.cooling,
                    "heating": s.heating,
                    "bits": bits,
                },
                "applied": {
                    "nutrients": s.nutrients_applied,
                    "mixing": s.mixing_applied,
                    "cooling": s.cooling_applied,
                    "heating": s.heating_applied,
                },
                "simultaneousHC": simultaneous,
                "stepCost": round(
                    step_cost(
                        s.nutrients_applied,
                        s.mixing_applied,
                        s.cooling_applied,
                        s.heating_applied,
                    ),
                    3,
                ),
            }
        )
    return rows
