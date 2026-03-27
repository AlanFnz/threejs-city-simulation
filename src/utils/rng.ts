export type RNG = () => number;

/**
 * mulberry32: small, fast, deterministic PRNG. Given the same seed it always
 * produces the same sequence, which is what makes the simulation testable
 * and (later) replayable/serializable.
 */
export function mulberry32(seed: number): RNG {
  let state = seed >>> 0;
  return function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng: RNG = mulberry32(Date.now());

/** Reseed the shared sim RNG, e.g. for deterministic tests. */
export function setSeed(seed: number): void {
  rng = mulberry32(seed);
}

/** Drop-in replacement for Math.random() for all simulation randomness. */
export function random(): number {
  return rng();
}
