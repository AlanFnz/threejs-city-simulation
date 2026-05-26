import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tile } from '.';
import { BUILDING_TYPE } from '../building/constants';
import { cityEvents } from '../../events';

describe('Tile building/road events', () => {
  beforeEach(() => {
    cityEvents.clear();
  });

  it('placeBuilding emits buildingPlaced with the building type', () => {
    const tile = new Tile(3, 4);
    const listener = vi.fn();
    cityEvents.on('buildingPlaced', listener);

    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(listener).toHaveBeenCalledWith({
      x: 3,
      y: 4,
      buildingType: BUILDING_TYPE.RESIDENTIAL,
    });
  });

  it('placeBuilding with a non-road type does not emit roadNetworkChanged', () => {
    const tile = new Tile(0, 0);
    const listener = vi.fn();
    cityEvents.on('roadNetworkChanged', listener);

    tile.placeBuilding(BUILDING_TYPE.COMMERCIAL);

    expect(listener).not.toHaveBeenCalled();
  });

  it('placeBuilding with BUILDING_TYPE.ROAD also emits roadNetworkChanged', () => {
    const tile = new Tile(1, 2);
    const listener = vi.fn();
    cityEvents.on('roadNetworkChanged', listener);

    tile.placeBuilding(BUILDING_TYPE.ROAD);

    expect(listener).toHaveBeenCalledWith({ x: 1, y: 2 });
  });

  it('removeBuilding emits buildingRemoved', () => {
    const tile = new Tile(5, 6);
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const listener = vi.fn();
    cityEvents.on('buildingRemoved', listener);

    tile.removeBuilding();

    expect(listener).toHaveBeenCalledWith({ x: 5, y: 6 });
  });

  it('removeBuilding on an empty tile emits nothing', () => {
    const tile = new Tile(0, 0);
    const removedListener = vi.fn();
    const roadListener = vi.fn();
    cityEvents.on('buildingRemoved', removedListener);
    cityEvents.on('roadNetworkChanged', roadListener);

    tile.removeBuilding();

    expect(removedListener).not.toHaveBeenCalled();
    expect(roadListener).not.toHaveBeenCalled();
  });

  it('removing a road also emits roadNetworkChanged', () => {
    const tile = new Tile(7, 8);
    tile.placeBuilding(BUILDING_TYPE.ROAD);
    cityEvents.clear(); // discard the placement's own events
    const listener = vi.fn();
    cityEvents.on('roadNetworkChanged', listener);

    tile.removeBuilding();

    expect(listener).toHaveBeenCalledWith({ x: 7, y: 8 });
  });

  it('removing a non-road building does not emit roadNetworkChanged', () => {
    const tile = new Tile(0, 0);
    tile.placeBuilding(BUILDING_TYPE.INDUSTRIAL);
    cityEvents.clear();
    const listener = vi.fn();
    cityEvents.on('roadNetworkChanged', listener);

    tile.removeBuilding();

    expect(listener).not.toHaveBeenCalled();
  });
});
