import { afterEach, describe, expect, it } from 'vitest';
import { City } from '../city';
import { DevelopmentState } from '../city/building/attributes/development';
import { BUILDING_TYPE } from '../city/building/constants';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { cityEvents } from '../events';
import { createCityServicesUiState } from './cityServices';

afterEach(() => cityEvents.clear());

describe('createCityServicesUiState', () => {
  it('returns unavailable percentages without developed zones', () => {
    expect(createCityServicesUiState(new City(2))).toEqual({
      road: { id: 'road', covered: 0, total: 0, percentage: null },
      power: { id: 'power', covered: 0, total: 0, percentage: null },
      fire: { id: 'fire', covered: 0, total: 0, percentage: null },
      police: { id: 'police', covered: 0, total: 0, percentage: null },
      health: { id: 'health', covered: 0, total: 0, percentage: null },
      education: {
        id: 'education',
        covered: 0,
        total: 0,
        percentage: null,
      },
    });
  });

  it('measures access and civic coverage across developed zones only', () => {
    const city = new City(3);
    city.getTile(0, 0)?.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    city.getTile(1, 0)?.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    city.getTile(2, 0)?.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const first = city.getTile(0, 0);
    const second = city.getTile(1, 0);
    (first?.building as ResidentialZone).development.state =
      DevelopmentState.DEVELOPED;
    (second?.building as ResidentialZone).development.state =
      DevelopmentState.DEVELOPED;

    if (first?.roadAccess) first.roadAccess.value = true;
    if (first?.powerAccess) first.powerAccess.value = true;
    if (first?.fireStationCoverage) first.fireStationCoverage.value = true;
    if (second?.roadAccess) second.roadAccess.value = true;
    if (second?.hospitalCoverage) second.hospitalCoverage.value = true;

    expect(createCityServicesUiState(city)).toEqual({
      road: { id: 'road', covered: 2, total: 2, percentage: 100 },
      power: { id: 'power', covered: 1, total: 2, percentage: 50 },
      fire: { id: 'fire', covered: 1, total: 2, percentage: 50 },
      police: { id: 'police', covered: 0, total: 2, percentage: 0 },
      health: { id: 'health', covered: 1, total: 2, percentage: 50 },
      education: { id: 'education', covered: 0, total: 2, percentage: 0 },
    });
  });
});
