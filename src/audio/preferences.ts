export const channels = [
  'ambience',
  'vehicles',
  'effects',
  'interface',
  'music',
] as const;
export type Channel = (typeof channels)[number];
type Preferences = Record<Channel, number> & {
  enabled: boolean;
  master: number;
};

const key = 'puerto-claro.sound.v1';
const defaults: Preferences = {
  enabled: false,
  master: 0.8,
  ambience: 0.85,
  vehicles: 0.75,
  effects: 0.62,
  interface: 0.5,
  music: 0,
};
function restore(): Preferences {
  const values = { ...defaults };
  if (typeof window === 'undefined') return values;
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    values.enabled = saved.enabled === true;
    for (const channel of ['master', ...channels] as const) {
      if (Number.isFinite(saved[channel]))
        values[channel] = Math.max(0, Math.min(1, saved[channel]));
    }
  } catch {
    /* Storage can be unavailable in a private window. */
  }
  return values;
}

let preferences = restore();
const subscribers = new Set<() => void>();
export const soundSettings = {
  read: () => preferences,
  subscribe(listener: () => void) {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  },
  change(patch: Partial<Preferences>) {
    preferences = { ...preferences, ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch {
      /* Session-only settings. */
    }
    for (const listener of subscribers) listener();
  },
};
