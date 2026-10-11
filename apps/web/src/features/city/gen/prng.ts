// Deterministic randomness: same seed string, same city.

/** 32-bit FNV-1a hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = {
  /** Uniform in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
};

/** mulberry32 seeded from a string (plus an optional stream name, so features don't shift each other). */
export function rng(seed: string, stream = ''): Rng {
  let a = hashString(`${seed}:${stream}`);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
  };
}

/** Smooth 1D value noise in [-1, 1], used for lane wobble. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    let t = Math.imul(n ^ seed, 0x27d4eb2d);
    t ^= t >>> 15;
    t = Math.imul(t, 0x85ebca6b);
    return ((t ^ (t >>> 13)) >>> 0) / 4294967296;
  };
  const u = f * f * (3 - 2 * f);
  return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
}

/** Cheap 2D value noise in [0, 1] for ground colour and far hills. */
export function noise2(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const h = (a: number, b: number) => {
    let t = Math.imul(a, 374761393) + Math.imul(b, 668265263);
    t = Math.imul(t ^ (t >>> 13), 1274126177);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = h(xi, zi) * (1 - ux) + h(xi + 1, zi) * ux;
  const b = h(xi, zi + 1) * (1 - ux) + h(xi + 1, zi + 1) * ux;
  return a * (1 - uz) + b * uz;
}
