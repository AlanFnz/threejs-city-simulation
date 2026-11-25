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
});
