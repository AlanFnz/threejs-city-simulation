import { SyntheticEvent, useCallback, useState } from 'react';

type DisclosurePreferenceKey = 'goals' | 'city-overview';

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_PREFIX = 'threejs-city-simulation:ui:disclosure:';

function storageKey(key: DisclosurePreferenceKey): string {
  return `${STORAGE_PREFIX}${key}`;
}

function readDisclosurePreference(
  storage: PreferenceStorage | null,
  key: DisclosurePreferenceKey,
  defaultOpen: boolean = true
): boolean {
  if (!storage) return defaultOpen;
  try {
    const value = storage.getItem(storageKey(key));
    if (value === 'open') return true;
    if (value === 'closed') return false;
  } catch {
    return defaultOpen;
  }
  return defaultOpen;
}

function writeDisclosurePreference(
  storage: PreferenceStorage | null,
  key: DisclosurePreferenceKey,
  isOpen: boolean
): void {
  if (!storage) return;
  try {
    storage.setItem(storageKey(key), isOpen ? 'open' : 'closed');
  } catch {
    // UI preferences are optional; storage failures must not break the HUD.
  }
}

function getBrowserStorage(): PreferenceStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function useDisclosurePreference(
  key: DisclosurePreferenceKey,
  defaultOpen: boolean = true
) {
  const [isOpen, setIsOpen] = useState(() =>
    readDisclosurePreference(getBrowserStorage(), key, defaultOpen)
  );
  const onToggle = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) => {
      const nextOpen = event.currentTarget.open;
      setIsOpen(nextOpen);
      writeDisclosurePreference(getBrowserStorage(), key, nextOpen);
    },
    [key]
  );

  return { isOpen, onToggle };
}

export {
  readDisclosurePreference,
  useDisclosurePreference,
  writeDisclosurePreference,
};
