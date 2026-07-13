"""Fitness for hybrid schedule chromosome on a chosen scenario (or multi)."""

from __future__ import annotations

from typing import Dict, List, Sequence, Tuple

import numpy as np

from chromosome import DecodedChromosome, decode_chromosome
from model import simulate_from_chromosome

SAFE_LOW = 35.0
SAFE_HIGH = 39.0
TARGET = 37.0
UNSAFE_LOW = 34.0
UNSAFE_HIGH = 42.0

W_IN_RANGE = 30.0
W_TARGET = 10.0
W_OUT = 50.0
W_COST = 0.15
W_UNSAFE = 100.0


def trajectory_fitness(temps: np.ndarray, cost: float) -> Tuple[float, dict]:
    series = np.asarray(temps, dtype=float)
    in_range = float(np.mean((series >= SAFE_LOW) & (series <= SAFE_HIGH)))
    error = float(np.mean(np.abs(series - TARGET)))
    above = np.maximum(0.0, series - SAFE_HIGH)
    below = np.maximum(0.0, SAFE_LOW - series)
    out_pen = float(np.mean(above ** 2 + below ** 2))
    unsafe = int(np.sum((series < UNSAFE_LOW) | (series > UNSAFE_HIGH)))

    perfect = 1.0 if in_range >= 0.999 and error < 0.4 else 0.0

    f = (
        W_IN_RANGE * in_range
        - W_TARGET * error
        - W_OUT * out_pen
        - W_COST * cost
        - W_UNSAFE * unsafe
        + 12.0 * perfect
    )

    stats = {
        "pctInRange": round(in_range, 4),
        "meanAbsErrorFrom37": round(error, 4),
        "controlCost": round(float(cost), 3),
        "maxTemperature": round(float(np.max(series)), 3),
        "minTemperature": round(float(np.min(series)), 3),
        "unsafeSteps": unsafe,
        "fitness": round(float(f), 4),
    }
    return float(f), stats


def evaluate_on_scenario(
    bits: np.ndarray,
    scenario: dict,
) -> Tuple[float, DecodedChromosome, dict]:
    decoded = decode_chromosome(bits)
    scale = float(scenario.get("disturbanceScale", 1.0))
    temps, applied, cost = simulate_from_chromosome(
        decoded,
        t0=scenario["T0"],
        disturbance=scenario["disturbance"],
        noise=scenario["noise"],
        disturbance_scale=scale,
    )
    f, stats = trajectory_fitness(temps, cost)
    return f, decoded, {
        "temps": temps,
        "applied": applied,
        "stats": stats,
        "cost": cost,
    }


def evaluate_multi(
    bits: np.ndarray,
    scenarios: Sequence[dict],
    mean_w: float = 0.6,
    min_w: float = 0.4,
) -> Tuple[float, DecodedChromosome, dict]:
    scores = []
    details = []
    decoded = None
    for sc in scenarios:
        f, decoded, detail = evaluate_on_scenario(bits, sc)
        scores.append(f)
        details.append(detail)
    arr = np.array(scores, dtype=float)
    agg = mean_w * float(np.mean(arr)) + min_w * float(np.min(arr))
    return float(agg), decoded, {
        "scores": scores,
        "details": details,
        "aggregate": agg,
    }
