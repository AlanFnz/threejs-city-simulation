import { describe, expect, it, vi } from 'vitest';
import {
  readDisclosurePreference,
  writeDisclosurePreference,
} from './disclosurePreferences';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('disclosure preferences', () => {
  it('defaults open and round-trips each panel independently', () => {
    const storage = memoryStorage();

    expect(readDisclosurePreference(storage, 'goals')).toBe(true);
    writeDisclosurePreference(storage, 'goals', false);

    expect(readDisclosurePreference(storage, 'goals')).toBe(false);
    expect(readDisclosurePreference(storage, 'city-overview')).toBe(true);
    expect(readDisclosurePreference(storage, 'controls', false)).toBe(false);
    writeDisclosurePreference(storage, 'controls', true);
    expect(readDisclosurePreference(storage, 'controls', false)).toBe(true);
  });

  it('falls back safely when storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('Storage unavailable');
      }),
      setItem: vi.fn(() => {
        throw new Error('Storage unavailable');
      }),
    };

    expect(readDisclosurePreference(storage, 'goals')).toBe(true);
    expect(() =>
      writeDisclosurePreference(storage, 'goals', false)
    ).not.toThrow();
  });
});
