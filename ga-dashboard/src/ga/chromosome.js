export const CHROMOSOME_BITS = 12;

function bitsToInt(bits, start, len) {
  let v = 0;
  for (let i = 0; i < len; i += 1) v = (v << 1) | (bits[start + i] ? 1 : 0);
  return v;
}

function intToBits(value, len) {
  const v = value & ((1 << len) - 1);
  return Array.from({ length: len }, (_, i) => (v >> (len - 1 - i)) & 1);
}

function writeField(bits, start, value) {
  intToBits(value & 7, 3).forEach((b, i) => {
    bits[start + i] = b;
  });
}

export function randomBits() {
  const bits = Array(CHROMOSOME_BITS).fill(0);
  writeField(bits, 0, Math.floor(Math.random() * 8));
  writeField(bits, 3, Math.floor(Math.random() * 8));
  writeField(bits, 6, Math.floor(Math.random() * 8));
  writeField(bits, 9, Math.floor(Math.random() * 8));
  return bits;
}

export function encodeAction({ n = 0, m = 0, c = 0, h = 0 }) {
  const bits = Array(CHROMOSOME_BITS).fill(0);
  writeField(bits, 0, n & 7);
  writeField(bits, 3, m & 7);
  writeField(bits, 6, c & 7);
  writeField(bits, 9, h & 7);
  return bits;
}

export function decodeAction(bits) {
  return {
    n: bitsToInt(bits, 0, 3),
    m: bitsToInt(bits, 3, 3),
    c: bitsToInt(bits, 6, 3),
    h: bitsToInt(bits, 9, 3)
  };
}

export function levelToBits(level) {
  return (level & 7).toString(2).padStart(3, "0");
}

export function formatBits(n, m, c, h) {
  return `[${levelToBits(n)} ${levelToBits(m)} ${levelToBits(c)} ${levelToBits(h)}]`;
}

export function formatChromosome(bits) {
  const a = decodeAction(bits);
  return formatBits(a.n, a.m, a.c, a.h);
}

export function diverseSeedPopulation(count) {
  const seeds = [];

  for (let k = 0; k <= 7; k += 1) {
    seeds.push(encodeAction({ n: 0, m: 0, c: k, h: 0 }));
    seeds.push(encodeAction({ n: 0, m: 0, c: 0, h: k }));
    seeds.push(encodeAction({ n: k, m: 0, c: 0, h: 0 }));
    seeds.push(encodeAction({ n: 0, m: k, c: 0, h: 0 }));
  }

  for (let k = 0; k <= 7; k += 1) {
    seeds.push(encodeAction({ n: 0, m: k, c: k, h: 0 }));
    seeds.push(encodeAction({ n: k, m: 0, c: 0, h: k }));
    seeds.push(encodeAction({ n: k, m: k, c: 0, h: 0 }));
    seeds.push(encodeAction({ n: 0, m: 0, c: k, h: Math.max(0, 7 - k) }));
    seeds.push(encodeAction({ n: 7 - k, m: k, c: Math.floor(k / 2), h: 0 }));
  }

  for (let c = 0; c <= 7; c += 2) {
    for (let h = 0; h <= 7; h += 2) {
      seeds.push(
        encodeAction({
          n: (c + h) % 8,
          m: (c * 2 + h) % 8,
          c,
          h
        })
      );
    }
  }

  while (seeds.length < count) seeds.push(randomBits());

  for (let i = seeds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  return seeds.slice(0, count);
}

export function crossover(a, b) {
  if (Math.random() > 0.85) return [a.slice(), b.slice()];
  const c1 = a.slice();
  const c2 = b.slice();
  for (let f = 0; f < 4; f += 1) {
    if (Math.random() < 0.5) {
      const i = f * 3;
      for (let j = 0; j < 3; j += 1) {
        const tmp = c1[i + j];
        c1[i + j] = c2[i + j];
        c2[i + j] = tmp;
      }
    }
  }
  return [c1, c2];
}

export function mutate(bits, rate = 0.28) {
  const out = bits.slice();
  for (let f = 0; f < 4; f += 1) {
    if (Math.random() < rate) {
      writeField(out, f * 3, Math.floor(Math.random() * 8));
    }
  }
  for (let i = 0; i < CHROMOSOME_BITS; i += 1) {
    if (Math.random() < rate * 0.2) out[i] = 1 - out[i];
  }
  return out;
}
