import { useSyncExternalStore, type RefObject } from 'react';
import { channels, soundSettings } from '../../audio/preferences';

export function SoundControls({
  open,
  toggle,
  button,
}: {
  open: boolean;
  toggle: () => void;
  button: RefObject<HTMLButtonElement | null>;
}) {
  const prefs = useSyncExternalStore(
    soundSettings.subscribe,
    soundSettings.read,
    soundSettings.read
  );
  return (
    <>
      <button
        className="sound-trigger"
        type="button"
        ref={button}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="sound-panel"
        title={prefs.enabled ? 'Sound settings' : 'Enable city sound'}
        onClick={() => {
          if (!prefs.enabled && !open) soundSettings.change({ enabled: true });
          toggle();
        }}
      >
        <span aria-hidden="true">{prefs.enabled ? '♫' : '♩'}</span>{' '}
        {prefs.enabled ? 'Sound' : 'Sound off'}
      </button>
      {open && (
        <section
          className="sound-panel hud-panel"
          id="sound-panel"
          role="dialog"
          aria-label="City sound"
        >
          <header>
            <strong>City sound</strong>
            <button
              type="button"
              aria-pressed={!prefs.enabled}
              onClick={() => soundSettings.change({ enabled: !prefs.enabled })}
            >
              {prefs.enabled ? 'Mute all' : 'Unmute'}
            </button>
          </header>
          {(['master', ...channels] as const).map((name) => (
            <label key={name}>
              <span>{name === 'master' ? 'Overall' : name}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(prefs[name] * 100)}
                aria-label={name + ' volume'}
                onChange={(e) =>
                  soundSettings.change({ [name]: Number(e.target.value) / 100 })
                }
              />
              <output>{Math.round(prefs[name] * 100)}%</output>
            </label>
          ))}
        </section>
      )}
    </>
  );
}
