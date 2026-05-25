import { describe, it, expect } from 'vitest';
import { mulberry32, setSeed, random } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const sequenceA = Array.from({ length: 5 }, () => a());
    const sequenceB = Array.from({ length: 5 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('always returns values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('setSeed / random', () => {
  it('reseeds the shared sim RNG deterministically', () => {
    setSeed(123);
    const first = Array.from({ length: 5 }, () => random());

    setSeed(123);
    const second = Array.from({ length: 5 }, () => random());

    expect(first).toEqual(second);
  });
});
