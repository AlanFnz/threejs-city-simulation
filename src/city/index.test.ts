import { describe, it, expect, beforeEach } from 'vitest';
import { City } from '.';
import { BUILDING_TYPE } from './building/constants';
import CONFIG from '../config';
import { cityEvents } from '../events';

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

describe('reactive road access', () => {
  const SEARCH_DISTANCE = CONFIG.ATTRIBUTES.ROAD_ACCESS.SEARCH_DISTANCE;

  beforeEach(() => {
    cityEvents.clear();
  });

  it('placing a road updates road access for a tile within range without a simulate() tick', () => {
    const city = new City(10);
    const nearTile = city.getTile(5, 5 - SEARCH_DISTANCE)!;
    expect(nearTile.roadAccess?.value).toBe(false);

    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.ROAD);

    expect(nearTile.roadAccess?.value).toBe(true);
  });

  it('placing a road does not affect a tile beyond SEARCH_DISTANCE', () => {
    const city = new City(10);
    const farTile = city.getTile(5, 5 - SEARCH_DISTANCE - 1)!;

    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.ROAD);

    expect(farTile.roadAccess?.value).toBe(false);
  });

  it('placing a non-road building next to an existing road picks up road access immediately', () => {
    const city = new City(10);
    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.ROAD);

    const zoneTile = city.getTile(5, 6)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(zoneTile.roadAccess?.value).toBe(true);
  });

  it('removing the only road in range clears road access for previously-in-range tiles', () => {
    const city = new City(10);
    const roadTile = city.getTile(5, 5)!;
    roadTile.placeBuilding(BUILDING_TYPE.ROAD);
    const nearTile = city.getTile(5, 6)!;
    expect(nearTile.roadAccess?.value).toBe(true);

    roadTile.removeBuilding();

    expect(nearTile.roadAccess?.value).toBe(false);
  });
});
