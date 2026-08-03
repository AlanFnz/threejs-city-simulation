import { describe, expect, it } from 'vitest';
import { getCityMapTileFromPoint } from '.';

describe('getCityMapTileFromPoint', () => {
  it('maps canvas positions to city coordinates', () => {
    expect(getCityMapTileFromPoint(0, 0, 128, 128, 16)).toEqual({
      x: 0,
      y: 0,
    });
    expect(getCityMapTileFromPoint(68, 36, 128, 128, 16)).toEqual({
      x: 8,
      y: 4,
    });
    expect(getCityMapTileFromPoint(128, 128, 128, 128, 16)).toEqual({
      x: 15,
      y: 15,
    });
  });

  it('rejects invalid dimensions and clamps points to the city', () => {
    expect(getCityMapTileFromPoint(10, 10, 0, 128, 16)).toBeNull();
    expect(getCityMapTileFromPoint(-10, 180, 128, 128, 16)).toEqual({
      x: 0,
      y: 15,
    });
  });
});
