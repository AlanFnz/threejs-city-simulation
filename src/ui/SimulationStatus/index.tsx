interface SimulationStatusProps {
  isPaused: boolean;
}

function SimulationStatus({ isPaused }: SimulationStatusProps) {
  if (!isPaused) return null;

  return (
    <div
      id="simulation-pause-indicator"
      role="status"
      aria-live="polite"
      aria-label="Simulation paused. Press Space to resume."
    >
      <span className="pause-indicator-icon" aria-hidden="true">
        <i />
        <i />
      </span>
      <strong>Simulation paused</strong>
      <span className="pause-resume-hint">
        <kbd>Space</kbd>
        <span>to resume</span>
      </span>
    </div>
  );
}

export { SimulationStatus };
