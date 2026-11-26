import { Box3 } from 'three';
import { expect, it } from 'vitest';
import { METERS_PER_TILE } from '../assetManager/worldScale';
import { ResidentFigure } from './residentFigure';

class SeatedResident extends ResidentFigure {
  takeSeat(): void {
    this.sit();
  }
}

it('keeps residents at adult height relative to the road and feet at pavement level when seated', () => {
  const bounds = new Box3();
  const figure = new SeatedResident();
  for (const id of ['puerto-0', 'puerto-2', 'puerto-41', 'puerto-217']) {
    figure.dress(id);
    bounds.setFromObject(figure, true);
    expect(bounds.max.y * METERS_PER_TILE).toBeGreaterThan(1.6);
    expect(bounds.max.y * METERS_PER_TILE).toBeLessThan(1.9);
    expect(Math.abs(bounds.min.y * METERS_PER_TILE)).toBeLessThan(0.02);
  }
  figure.takeSeat();
  bounds.setFromObject(figure, true);
  expect(bounds.max.y * METERS_PER_TILE).toBeLessThan(1.45);
  expect(Math.abs(bounds.min.y * METERS_PER_TILE)).toBeLessThan(0.08);
});
