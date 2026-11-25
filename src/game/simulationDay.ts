export const STARTING_SIMULATION_DAY = 1;

export function normalizeSimulationDay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return STARTING_SIMULATION_DAY;
  }
  return Math.max(STARTING_SIMULATION_DAY, Math.floor(value));
}

export const MINUTES_PER_DAY = 24 * 60;
export const STARTING_MINUTE = 9 * 60;
export const LIGHTING_HOURS = { Day: 12, Dusk: 18.5, Night: 0 } as const;
export type LightingMode = 'Auto' | keyof typeof LIGHTING_HOURS;

export function normalizeMinute(value: unknown): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < MINUTES_PER_DAY
    ? Math.floor(value)
    : STARTING_MINUTE;
}

export function normalizeLightingMode(value: unknown): LightingMode {
  return value === 'Day' || value === 'Dusk' || value === 'Night'
    ? value
    : 'Auto';
}
