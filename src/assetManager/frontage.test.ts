import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { City } from '../city';
import { BUILDING_TYPE } from '../city/building/constants';
import { getBuildingFacing } from './frontage';

let city: City;
beforeEach(() => {
  city = new City(5);
});
afterEach(() => city.dispose());

describe('street and utility edits around an existing building', () => {
  it('refreshes a finished facade when an adjacent road is built or removed', () => {
    const home = city.getTile(1, 1)!;
    home.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const facing = () =>
      getBuildingFacing(city, 1, 1, BUILDING_TYPE.RESIDENTIAL);
    city.getTile(2, 2)!.placeBuilding(BUILDING_TYPE.ROAD);
    expect(facing()).toBeNull();
    home.building!.isMeshOutOfDate = false;
    const road = city.getTile(2, 1)!;
    road.placeBuilding(BUILDING_TYPE.ROAD);
    expect(home.building!.isMeshOutOfDate).toBe(true);
    expect(facing()).toBe(1);
    city.getTile(1, 0)!.placeBuilding(BUILDING_TYPE.ROAD);
    home.building!.isMeshOutOfDate = false;
    road.removeBuilding();
    expect(home.building!.isMeshOutOfDate).toBe(true);
    expect(facing()).toBe(2);
  });

  it('updates the crossarm at a bend when a pole or plant changes', () => {
    const pole = city.getTile(0, 0)!;
    pole.placeBuilding(BUILDING_TYPE.POWER_LINE);
    const facing = () =>
      getBuildingFacing(city, 0, 0, BUILDING_TYPE.POWER_LINE);
    const plant = city.getTile(1, 0)!;
    plant.placeBuilding(BUILDING_TYPE.POWER_PLANT);
    expect(facing()).toBe(1);
    city.getTile(0, 1)!.placeBuilding(BUILDING_TYPE.POWER_LINE);
    expect(facing()).toBe(0.5);
    pole.building!.isMeshOutOfDate = false;
    plant.removeBuilding();
    expect(pole.building!.isMeshOutOfDate).toBe(true);
    expect(facing()).toBe(0);
  });
});
