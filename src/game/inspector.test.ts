import { afterEach, describe, expect, it } from 'vitest';
import CONFIG from '../config';
import { City } from '../city';
import { BUILDING_TYPE } from '../city/building/constants';
import { createInspectorUiState } from './inspector';

let city: City | null = null;

afterEach(() => {
  city?.dispose();
  city = null;
});

describe('createInspectorUiState', () => {
  it('maps an empty tile and its local service access', () => {
    city = new City(4);
    const tile = city.getTile(1, 2);
    if (!tile) throw new Error('Expected tile');

    const state = createInspectorUiState(tile, city);

    expect(state).toMatchObject({
      x: 1,
      y: 2,
      terrain: 'ground',
      building: null,
    });
    expect(state.services).toHaveLength(6);
    expect(state.services.every((service) => !service.available)).toBe(true);
  });

  it('maps zone development, cost, and occupancy without HTML', () => {
    city = new City(4);
    const tile = city.getTile(1, 1);
    if (!tile) throw new Error('Expected tile');
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    const state = createInspectorUiState(tile, city);

    expect(state.building).toMatchObject({
      type: BUILDING_TYPE.RESIDENTIAL,
      title: 'Residential zone',
      category: 'Residential zone',
      state: 'undeveloped',
      level: 1,
      buildCost: CONFIG.ECONOMY.BUILD_COST.RESIDENTIAL,
      upkeep: null,
      occupancy: {
        label: 'Residents',
        current: 0,
        maximum: CONFIG.ZONE.MAX_RESIDENTS,
        people: [],
      },
    });
  });

  it('reports power-plant grid capacity', () => {
    city = new City(4);
    const tile = city.getTile(0, 0);
    if (!tile) throw new Error('Expected tile');
    tile.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const state = createInspectorUiState(tile, city);

    expect(state.building).toMatchObject({
      title: 'Power Plant',
      powerLoad: 0,
      powerCapacity: CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY,
      upkeep: CONFIG.ECONOMY.UPKEEP.POWER_PLANT,
    });
  });
});
