const CONTROL_HINTS = [
  { action: 'Select / build', input: 'Left click' },
  { action: 'Orbit camera', input: 'Right drag' },
  { action: 'Pan camera', input: 'Ctrl + right drag' },
  { action: 'Zoom camera', input: 'Wheel' },
  { action: 'Build tools', input: '1–9 · R · B' },
  { action: 'Pause / speed', input: 'Space · .' },
  { action: 'Cinematic HUD', input: 'H' },
] as const;

function ControlsLegend() {
  return (
    <aside
      id="controls-legend"
      className="hud-panel"
      aria-label="Camera and city controls"
    >
      <header className="controls-heading">
        <span className="controls-heading-icon" aria-hidden="true">
          ?
        </span>
        <span>
          <small>Quick reference</small>
          <strong>Controls</strong>
        </span>
      </header>
      <ul className="control-hint-list">
        {CONTROL_HINTS.map(({ action, input }) => (
          <li key={action}>
            <span>{action}</span>
            <kbd>{input}</kbd>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export { ControlsLegend };
