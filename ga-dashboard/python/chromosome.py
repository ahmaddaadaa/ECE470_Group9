# 96-bit schedule: 8 steps x 12 bits (N M C H, 3 bits each, levels 0-7)

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np

HORIZON = 8
BITS_PER_ACTION = 3
ACTIONS_PER_STEP = 4  # N, M, C, H
BITS_PER_STEP = BITS_PER_ACTION * ACTIONS_PER_STEP  # 12
CHROMOSOME_BITS = HORIZON * BITS_PER_STEP  # 96

ACTION_ORDER = ("nutrients", "mixing", "cooling", "heating")


@dataclass
class ActionStep:
    t: int
    nutrients: int
    mixing: int
    cooling: int
    heating: int
    nutrients_applied: int = 0
    mixing_applied: int = 0
    cooling_applied: int = 0
    heating_applied: int = 0


@dataclass
class DecodedChromosome:
    binary: str
    binary_grouped: str
    commands: List[ActionStep]


def _bits_to_int(bits: np.ndarray) -> int:
    value = 0
    for b in bits:
        value = (value << 1) | int(b)
    return value


def _int_to_bits(value: int, width: int) -> List[int]:
    value = int(value) & ((1 << width) - 1)
    return [(value >> (width - 1 - i)) & 1 for i in range(width)]


def repair_bits(bits: np.ndarray) -> np.ndarray:
    b = np.asarray(bits, dtype=np.int8).copy()
    if b.size != CHROMOSOME_BITS:
        raise ValueError(f"expected {CHROMOSOME_BITS} bits, got {b.size}")
    return np.clip(b, 0, 1).astype(np.int8)


def random_chromosome(rng: np.random.Generator) -> np.ndarray:
    return repair_bits(rng.integers(0, 2, size=CHROMOSOME_BITS, dtype=np.int8))


def zero_chromosome() -> np.ndarray:
    return np.zeros(CHROMOSOME_BITS, dtype=np.int8)


def decode_chromosome(bits: np.ndarray) -> DecodedChromosome:
    bits = repair_bits(bits)
    commands: List[ActionStep] = []
    groups = []

    for t in range(HORIZON):
        base = t * BITS_PER_STEP
        chunk = bits[base : base + BITS_PER_STEP]
        n = _bits_to_int(chunk[0:3])
        m = _bits_to_int(chunk[3:6])
        c = _bits_to_int(chunk[6:9])
        h = _bits_to_int(chunk[9:12])
        commands.append(
            ActionStep(
                t=t,
                nutrients=n,
                mixing=m,
                cooling=c,
                heating=h,
            )
        )
        groups.append(
            f"{''.join(str(int(x)) for x in chunk[0:3])} "
            f"{''.join(str(int(x)) for x in chunk[3:6])} "
            f"{''.join(str(int(x)) for x in chunk[6:9])} "
            f"{''.join(str(int(x)) for x in chunk[9:12])}"
        )

    binary = "".join(str(int(b)) for b in bits)
    return DecodedChromosome(
        binary=binary,
        binary_grouped=" | ".join(groups),
        commands=commands,
    )


def commands_to_arrays(commands: List[ActionStep]):
    n = np.array([s.nutrients for s in commands], dtype=float)
    m = np.array([s.mixing for s in commands], dtype=float)
    c = np.array([s.cooling for s in commands], dtype=float)
    h = np.array([s.heating for s in commands], dtype=float)
    return n, m, c, h


def format_step_bits(n: int, m: int, c: int, h: int) -> str:
    def f(v: int) -> str:
        return "".join(str(b) for b in _int_to_bits(v, 3))

    return f"[{f(n)}, {f(m)}, {f(c)}, {f(h)}]"
