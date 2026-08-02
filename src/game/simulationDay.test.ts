import { describe, expect, it } from 'vitest';
import {
  normalizeSimulationDay,
  STARTING_SIMULATION_DAY,
} from './simulationDay';

describe('normalizeSimulationDay', () => {
  it('keeps whole positive days', () => {
    expect(normalizeSimulationDay(42)).toBe(42);
  });

  it('rounds down partial days and clamps values before day one', () => {
    expect(normalizeSimulationDay(8.9)).toBe(8);
    expect(normalizeSimulationDay(0)).toBe(STARTING_SIMULATION_DAY);
  });

  it('falls back for legacy or invalid save values', () => {
    expect(normalizeSimulationDay(undefined)).toBe(STARTING_SIMULATION_DAY);
    expect(normalizeSimulationDay(Number.NaN)).toBe(STARTING_SIMULATION_DAY);
  });
});
