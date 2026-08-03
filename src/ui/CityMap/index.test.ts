import { describe, expect, it } from 'vitest';
import {
  getCityMapFocusPoint,
  getCityMapTileFromPoint,
  getCityMapTileLabel,
} from '.';

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

describe('getCityMapFocusPoint', () => {
  it('positions the camera marker over the focused city tile', () => {
    expect(getCityMapFocusPoint({ x: 7.5, y: 7.5 }, 16, 128)).toEqual({
      x: 64,
      y: 64,
    });
    expect(getCityMapFocusPoint({ x: 2, y: 5 }, 16, 128)).toEqual({
      x: 20,
      y: 44,
    });
  });

  it('keeps an out-of-bounds camera focus visible at the map edge', () => {
    expect(getCityMapFocusPoint({ x: -4, y: 22 }, 16, 128)).toEqual({
      x: 4,
      y: 124,
    });
  });
});

describe('getCityMapTileLabel', () => {
  it('names land use and infrastructure without exposing internal ids', () => {
    expect(getCityMapTileLabel('residential')).toBe('Residential');
    expect(getCityMapTileLabel('power-line')).toBe('Power line');
    expect(getCityMapTileLabel('empty')).toBe('Open land');
  });
});
