export const SIMULATION_SPEEDS = [1, 2, 3] as const;

export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export function getNextSimulationSpeed(
  currentSpeed: SimulationSpeed
): SimulationSpeed {
  const currentIndex = SIMULATION_SPEEDS.indexOf(currentSpeed);
  return SIMULATION_SPEEDS[(currentIndex + 1) % SIMULATION_SPEEDS.length];
}

export function getScheduledStepCount(
  isPaused: boolean,
  simulationSpeed: SimulationSpeed
): number {
  return isPaused ? 0 : simulationSpeed;
}
