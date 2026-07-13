#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from chromosome import decode_chromosome
from fitness import evaluate_on_scenario
from ga import run_ga_for_scenario
from model import (
    WEIGHTS,
    SLEW,
    COST_RATES,
    OVERLAP_TAX_BETA,
    actions_to_json,
    baseline_open_loop,
    full_trajectory_points,
)
from scenarios import generate_disturbed_dataset


def project_paths():
    here = Path(__file__).resolve().parent
    data_dir = here.parent / "public" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return {
        "data_dir": data_dir,
        "dataset": data_dir / "dataset.json",
        "results": data_dir / "ga_results.json",
    }


def build_results_payload(scenario: dict, ga_result: dict, dataset_meta: dict) -> dict:
    bits = ga_result["bestBits"]
    f, decoded, detail = evaluate_on_scenario(bits, scenario)
    temps = detail["temps"]
    applied = detail["applied"]
    stats = detail["stats"]

    scale = float(scenario.get("disturbanceScale", 1.0))
    base_temps = baseline_open_loop(
        scenario["T0"],
        scenario["disturbance"],
        scenario["noise"],
        scale,
    )

    return {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "mode": "schedule",
            "scenarioId": scenario["id"],
            "disturbanceScale": scale,
            "population": ga_result["config"]["population"],
            "generations": ga_result["config"]["generations"],
            "horizon": dataset_meta.get("horizon", 8),
            "controller": "open_loop",
            "slew": SLEW,
            "weights": WEIGHTS,
            "costRates": {**COST_RATES, "overlapTaxBeta": OVERLAP_TAX_BETA},
        },
        "scenario": {
            "id": scenario["id"],
            "T0": scenario["T0"],
            "disturbance": scenario["disturbance"],
            "noise": scenario["noise"],
            "disturbanceScale": scale,
        },
        "bestChromosome": {
            "binary": decoded.binary,
            "binaryGrouped": decoded.binary_grouped,
            "encoding": "[Nutrients 3b | Mixing 3b | Cooling 3b | Heating 3b] × T",
            "actions": actions_to_json(applied),
        },
        "fitness": {
            "aggregate": round(float(f), 4),
            "historyBest": ga_result["history"][-1]["bestFitness"]
            if ga_result["history"]
            else None,
        },
        "statistics": stats,
        "trajectories": {
            "baseline": full_trajectory_points(base_temps),
            "optimized": full_trajectory_points(temps),
        },
        "history": ga_result["history"],
    }


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--disturbance", type=float, default=1.0, dest="D")
    p.add_argument("--scenarios", type=int, default=20)
    p.add_argument("--scenario-id", type=str, default="sc_000")
    p.add_argument("--population", type=int, default=70)
    p.add_argument("--generations", type=int, default=100)
    p.add_argument("--seed", type=int, default=7)
    args = p.parse_args(argv)

    paths = project_paths()
    print(f"Applying disturbance D={args.D} to {args.scenarios} scenarios...")
    dataset = generate_disturbed_dataset(
        num_scenarios=args.scenarios,
        disturbance_scale=args.D,
        seed=args.seed,
    )
    with open(paths["dataset"], "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"  wrote {paths['dataset']}")

    scenario = next(
        (s for s in dataset["scenarios"] if s["id"] == args.scenario_id),
        dataset["scenarios"][0],
    )
    print(
        f"Running GA on {scenario['id']} "
        f"(baseline max T={scenario['baselineMaxTemp']}°C)..."
    )
    ga_result = run_ga_for_scenario(
        scenario,
        population_size=args.population,
        generations=args.generations,
        seed=args.seed,
    )
    payload = build_results_payload(scenario, ga_result, dataset)
    with open(paths["results"], "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    opt = payload["trajectories"]["optimized"]
    print(f"Fitness: {payload['fitness']['aggregate']}")
    print(f"Optimized temps: {[p['temperature'] for p in opt]}")
    print(f"In range: {100*payload['statistics']['pctInRange']:.1f}%")
    print(f"Cost: {payload['statistics']['controlCost']}")
    print(f"Wrote {paths['results']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
