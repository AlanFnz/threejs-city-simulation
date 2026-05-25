import { describe, it, expect } from 'vitest';
import { City } from '.';

describe('City.findTile', () => {
  it('finds a matching tile within range', () => {
    const city = new City(5);
    const target = city.getTile(2, 3)!;
    const found = city.findTile({ x: 0, y: 0 }, (tile) => tile === target, 10);
    expect(found).toBe(target);
  });

  it('returns null when no tile matches the filter', () => {
    const city = new City(5);
    const found = city.findTile({ x: 0, y: 0 }, () => false, 10);
    expect(found).toBeNull();
  });

  it('treats an otherwise-matching tile beyond maxDistance as unreachable', () => {
    const city = new City(5);
    const farTile = city.getTile(4, 4)!; // manhattan distance 8 from (0,0)
    const found = city.findTile({ x: 0, y: 0 }, (tile) => tile === farTile, 3);
    expect(found).toBeNull();
  });

  it('finds a match exactly at the distance cap', () => {
    const city = new City(5);
    const target = city.getTile(0, 3)!; // manhattan distance 3 from (0,0)
    const found = city.findTile({ x: 0, y: 0 }, (tile) => tile === target, 3);
    expect(found).toBe(target);
  });
});
