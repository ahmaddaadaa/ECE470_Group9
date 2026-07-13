"""Genetic algorithm for hybrid 96-bit action schedules."""

from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np

from chromosome import (
    CHROMOSOME_BITS,
    HORIZON,
    BITS_PER_STEP,
    random_chromosome,
    repair_bits,
    zero_chromosome,
)
from fitness import evaluate_on_scenario


def tournament_select(pop, fits, rng, k=3):
    idxs = rng.integers(0, len(pop), size=k)
    best = idxs[np.argmax(fits[idxs])]
    return pop[best].copy()


def crossover(a, b, rng, rate=0.85):
    if rng.random() > rate:
        return a.copy(), b.copy()
    # Prefer cuts on timestep boundaries
    boundaries = list(range(BITS_PER_STEP, CHROMOSOME_BITS, BITS_PER_STEP))
    if len(boundaries) >= 2 and rng.random() < 0.7:
        p1, p2 = sorted(rng.choice(boundaries, size=2, replace=False))
    else:
        p1, p2 = sorted(rng.integers(1, CHROMOSOME_BITS, size=2))
        if p1 == p2:
            p2 = min(p1 + 1, CHROMOSOME_BITS - 1)
    c1, c2 = a.copy(), b.copy()
    c1[p1:p2] = b[p1:p2]
    c2[p1:p2] = a[p1:p2]
    return repair_bits(c1), repair_bits(c2)


def mutate(bits, rng, rate=0.025):
    child = bits.copy()
    mask = rng.random(CHROMOSOME_BITS) < rate
    child[mask] = 1 - child[mask]
    return repair_bits(child)


def seeded_cooling_bias(rng: np.random.Generator) -> np.ndarray:
    """Individual that tends to cool/mix under disturbance (helps search)."""
    bits = zero_chromosome()
    # For mid timesteps, set moderate cooling + mixing commands
    for t in range(HORIZON):
        base = t * BITS_PER_STEP
        # nutrients 000, mixing ~010-100, cooling ~011-110, heating 000
        mix = int(rng.integers(2, 5))
        cool = int(rng.integers(3, 7)) if 1 <= t <= 5 else int(rng.integers(1, 4))
        # write 3-bit fields
        for i, val in enumerate(
            [
                0,  # N
                mix,  # M
                cool,  # C
                0,  # H
            ]
        ):
            for b_i, b in enumerate(
                [(val >> (2 - j)) & 1 for j in range(3)]
            ):
                bits[base + i * 3 + b_i] = b
    # light noise
    flip = rng.random(CHROMOSOME_BITS) < 0.04
    bits[flip] = 1 - bits[flip]
    return repair_bits(bits)


def run_ga_for_scenario(
    scenario: dict,
    population_size: int = 70,
    generations: int = 100,
    mutation_rate: float = 0.025,
    elite_count: int = 3,
    seed: int = 7,
    progress_every: int = 20,
) -> Dict:
    rng = np.random.default_rng(seed)

    n_seed = max(5, population_size // 5)
    inds = [seeded_cooling_bias(rng) for _ in range(n_seed)]
    inds.extend(random_chromosome(rng) for _ in range(population_size - n_seed))
    population = np.stack(inds, axis=0)

    history = []
    best_bits = None
    best_fit = -1e18
    best_detail = None
    best_decoded = None

    for gen in range(generations):
        fits = np.zeros(population_size)
        for i in range(population_size):
            f, decoded, detail = evaluate_on_scenario(population[i], scenario)
            fits[i] = f
            if f > best_fit:
                best_fit = f
                best_bits = population[i].copy()
                best_detail = detail
                best_decoded = decoded

        history.append(
            {
                "generation": gen,
                "bestFitness": round(float(np.max(fits)), 4),
                "avgFitness": round(float(np.mean(fits)), 4),
            }
        )

        elite_idx = np.argsort(fits)[-elite_count:]
        new_pop = [population[i].copy() for i in elite_idx]
        mut = mutation_rate if gen < generations * 0.65 else mutation_rate * 0.5

        while len(new_pop) < population_size:
            p1 = tournament_select(population, fits, rng)
            p2 = tournament_select(population, fits, rng)
            c1, c2 = crossover(p1, p2, rng)
            new_pop.append(mutate(c1, rng, mut))
            if len(new_pop) < population_size:
                new_pop.append(mutate(c2, rng, mut))

        population = np.stack(new_pop[:population_size], axis=0)

        if progress_every and (gen % progress_every == 0 or gen == generations - 1):
            print(
                f"  gen {gen:3d}: best={history[-1]['bestFitness']:.3f} "
                f"avg={history[-1]['avgFitness']:.3f}"
            )

    return {
        "bestBits": best_bits,
        "bestFitness": best_fit,
        "decoded": best_decoded,
        "detail": best_detail,
        "history": history,
        "config": {
            "population": population_size,
            "generations": generations,
            "mutationRate": mutation_rate,
            "eliteCount": elite_count,
            "seed": seed,
            "scenarioId": scenario.get("id"),
        },
    }
