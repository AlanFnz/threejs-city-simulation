export const DEFAULT_CITY_NAME = 'My City';
export const MAX_CITY_NAME_LENGTH = 40;

export function normalizeCityName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CITY_NAME;
  return value.trim().slice(0, MAX_CITY_NAME_LENGTH) || DEFAULT_CITY_NAME;
}
