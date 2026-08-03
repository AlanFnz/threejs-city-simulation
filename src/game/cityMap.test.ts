import { afterEach, describe, expect, it } from 'vitest';
import { City } from '../city';
import { BUILDING_TYPE } from '../city/building/constants';
import { cityEvents } from '../events';
import { createCityMapUiState } from './cityMap';

afterEach(() => cityEvents.clear());

describe('createCityMapUiState', () => {
  it('maps city buildings into compact HUD categories', () => {
    const city = new City(3);
    city.getTile(0, 0)?.placeBuilding(BUILDING_TYPE.ROAD);
    city.getTile(0, 1)?.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    city.getTile(0, 2)?.placeBuilding(BUILDING_TYPE.COMMERCIAL);
    city.getTile(1, 0)?.placeBuilding(BUILDING_TYPE.INDUSTRIAL);
    city.getTile(1, 1)?.placeBuilding(BUILDING_TYPE.POWER_LINE);
    city.getTile(1, 2)?.placeBuilding(BUILDING_TYPE.HOSPITAL);

    expect(createCityMapUiState(city)).toEqual({
      size: 3,
      tiles: [
        'road',
        'residential',
        'commercial',
        'industrial',
        'power',
        'service',
        'empty',
        'empty',
        'empty',
      ],
    });
  });
});
