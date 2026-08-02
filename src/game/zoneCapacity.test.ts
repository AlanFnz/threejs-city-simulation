import { afterEach, describe, expect, it } from 'vitest';
import { City } from '../city';
import { DevelopmentState } from '../city/building/attributes/development';
import { BUILDING_TYPE } from '../city/building/constants';
import { CommercialZone } from '../city/building/zones/commercialZone';
import { IndustrialZone } from '../city/building/zones/industrialZone';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { Citizen } from '../city/citizen';
import { CITIZEN_STATE } from '../city/citizen/constants';
import { cityEvents } from '../events';
import { createZoneCapacityUiState } from './zoneCapacity';

afterEach(() => cityEvents.clear());

describe('createZoneCapacityUiState', () => {
  it('returns empty capacity when no zones are developed', () => {
    const city = new City(4);
    city.getTile(0, 0)?.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(createZoneCapacityUiState(city)).toEqual({
      residential: {
        id: 'residential',
        occupied: 0,
        capacity: 0,
        utilization: null,
      },
      commercial: {
        id: 'commercial',
        occupied: 0,
        capacity: 0,
        utilization: null,
      },
      industrial: {
        id: 'industrial',
        occupied: 0,
        capacity: 0,
        utilization: null,
      },
    });
  });

  it('maps developed resident and job utilization by zone type', () => {
    const city = new City(4);
    city.getTile(0, 0)?.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    city.getTile(1, 0)?.placeBuilding(BUILDING_TYPE.COMMERCIAL);
    city.getTile(2, 0)?.placeBuilding(BUILDING_TYPE.INDUSTRIAL);
    const residential = city.getTile(0, 0)?.building as ResidentialZone;
    const commercial = city.getTile(1, 0)?.building as CommercialZone;
    const industrial = city.getTile(2, 0)?.building as IndustrialZone;
    residential.development.state = DevelopmentState.DEVELOPED;
    commercial.development.state = DevelopmentState.DEVELOPED;
    industrial.development.state = DevelopmentState.DEVELOPED;

    const resident = new Citizen(residential, {
      id: 'resident',
      firstName: 'Test',
      surname: 'Resident',
      age: 30,
      state: CITIZEN_STATE.UNEMPLOYED,
    });
    residential.residents.restore([resident]);
    commercial.jobs.hire(resident);

    expect(createZoneCapacityUiState(city)).toEqual({
      residential: {
        id: 'residential',
        occupied: 1,
        capacity: residential.residents.maximum,
        utilization: Math.round(100 / residential.residents.maximum),
      },
      commercial: {
        id: 'commercial',
        occupied: 1,
        capacity: commercial.jobs.maxWorkers,
        utilization: Math.round(100 / commercial.jobs.maxWorkers),
      },
      industrial: {
        id: 'industrial',
        occupied: 0,
        capacity: industrial.jobs.maxWorkers,
        utilization: 0,
      },
    });
  });
});
