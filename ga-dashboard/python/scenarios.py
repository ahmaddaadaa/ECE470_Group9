from __future__ import annotations

from typing import Dict, List

import numpy as np

from chromosome import HORIZON
from model import baseline_open_loop, full_trajectory_points

SAFE_LOW = 35.0
SAFE_HIGH = 39.0


def base_disturbance_profile(rng: np.random.Generator | None = None) -> List[float]:
    return [0.0, 0.8, 1.2, 1.0, 0.6, 0.3, 0.1, 0.0]


def generate_disturbed_dataset(
    num_scenarios: int = 20,
    disturbance_scale: float = 1.0,
    seed: int = 42,
) -> Dict:
    rng = np.random.default_rng(seed)
    base_d = np.array(base_disturbance_profile(), dtype=float)
    scenarios = []

    for i in range(num_scenarios):
        roll = rng.random()
        if roll < 0.45:
            t0 = float(rng.uniform(36.5, 37.5))
        elif roll < 0.80:
            t0 = float(rng.uniform(37.0, 38.5))
        else:
            t0 = float(rng.uniform(35.8, 36.8))

        scale_jitter = float(rng.uniform(0.85, 1.15))
        disturbance = (base_d * scale_jitter).tolist()
        noise = rng.normal(0.0, 0.06, size=HORIZON).tolist()

        temps = baseline_open_loop(
            t0=t0,
            disturbance=disturbance,
            noise=noise,
            disturbance_scale=disturbance_scale,
        )
        in_range = float(np.mean((temps >= SAFE_LOW) & (temps <= SAFE_HIGH)))

        scenarios.append(
            {
                "id": f"sc_{i:03d}",
                "T0": round(t0, 3),
                "disturbance": [round(float(x), 4) for x in disturbance],
                "noise": [round(float(x), 4) for x in noise],
                "disturbanceScale": disturbance_scale,
                "baselineTrajectory": full_trajectory_points(temps),
                "baselineMaxTemp": round(float(np.max(temps)), 3),
                "baselineMinTemp": round(float(np.min(temps)), 3),
                "baselinePctInRange": round(in_range, 4),
            }
        )

    d0 = base_d.tolist()
    n0 = [0.0] * HORIZON
    t0 = 37.0
    temps0 = baseline_open_loop(t0, d0, n0, disturbance_scale)
    scenarios[0] = {
        "id": "sc_000",
        "T0": 37.0,
        "disturbance": [round(float(x), 4) for x in d0],
        "noise": n0,
        "disturbanceScale": disturbance_scale,
        "baselineTrajectory": full_trajectory_points(temps0),
        "baselineMaxTemp": round(float(np.max(temps0)), 3),
        "baselineMinTemp": round(float(np.min(temps0)), 3),
        "baselinePctInRange": round(
            float(np.mean((temps0 >= SAFE_LOW) & (temps0 <= SAFE_HIGH))), 4
        ),
    }

    return {
        "disturbanceScale": disturbance_scale,
        "numScenarios": len(scenarios),
        "horizon": HORIZON,
        "baseDisturbanceProfile": [round(float(x), 4) for x in base_d],
        "scenarios": scenarios,
        "weights": {
            "wN": 0.20,
            "wM": 0.12,
            "wC": 0.35,
            "wH": 0.30,
        },
        "slew": {"nutrients": 2, "mixing": 2, "cooling": 3, "heating": 1},
        "costRates": {
            "nutrients": 0.50,
            "mixing": 0.40,
            "cooling": 1.00,
            "heating": 0.90,
            "overlapTaxBeta": 0.50,
        },
    }
