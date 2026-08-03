import { useDisclosurePreference } from '../disclosurePreferences';

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
  const disclosure = useDisclosurePreference('controls', false);

  return (
    <aside
      id="controls-legend"
      className="hud-panel"
      aria-label="Camera and city controls"
    >
      <details
        className="controls-legend-details"
        open={disclosure.isOpen}
        onToggle={disclosure.onToggle}
      >
        <summary className="controls-heading">
          <span className="controls-heading-icon" aria-hidden="true">
            ?
          </span>
          <span className="controls-heading-copy">
            <small>Quick reference</small>
            <strong>Controls</strong>
          </span>
          <span className="panel-collapse-indicator" aria-hidden="true" />
        </summary>
        <ul className="control-hint-list">
          {CONTROL_HINTS.map(({ action, input }) => (
            <li key={action}>
              <span>{action}</span>
              <kbd>{input}</kbd>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}

export { ControlsLegend };
