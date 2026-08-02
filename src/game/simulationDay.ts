export const STARTING_SIMULATION_DAY = 1;

export function normalizeSimulationDay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return STARTING_SIMULATION_DAY;
  }
  return Math.max(STARTING_SIMULATION_DAY, Math.floor(value));
}
