import { describe, expect, it } from 'vitest';
import {
  getNextSimulationSpeed,
  getScheduledStepCount,
} from './simulationSpeed';

describe('simulation speed', () => {
  it('cycles through 1x, 2x, 3x, then back to 1x', () => {
    expect(getNextSimulationSpeed(1)).toBe(2);
    expect(getNextSimulationSpeed(2)).toBe(3);
    expect(getNextSimulationSpeed(3)).toBe(1);
  });

  it('schedules the selected number of ticks while running', () => {
    expect(getScheduledStepCount(false, 1)).toBe(1);
    expect(getScheduledStepCount(false, 2)).toBe(2);
    expect(getScheduledStepCount(false, 3)).toBe(3);
  });

  it('schedules no ticks while paused', () => {
    expect(getScheduledStepCount(true, 3)).toBe(0);
  });
});
