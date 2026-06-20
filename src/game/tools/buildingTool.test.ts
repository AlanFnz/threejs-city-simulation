import { describe, it, expect, vi } from 'vitest';
import { BuildingTool } from './buildingTool';
import { GameContext } from './tool';
import { Tile } from '../../city/tile';
import { BUILDING_TYPE } from '../../city/building/constants';
import { ICity } from '../../city';

function fakeContext(): GameContext {
  return {
    city: { simulate: vi.fn() } as unknown as ICity,
    sceneManager: { update: vi.fn() } as unknown as GameContext['sceneManager'],
    setFocusedTile: vi.fn(),
  };
}

describe('BuildingTool', () => {
  it('places its building type on an empty tile, then simulates and re-renders', () => {
    const tool = new BuildingTool(BUILDING_TYPE.COMMERCIAL);
    const tile = new Tile(1, 1);
    const context = fakeContext();
    const object = { userData: tile } as unknown as THREE.Object3D;

    tool.onTileClick(tile, object, context);

    expect(tile.building?.type).toBe(BUILDING_TYPE.COMMERCIAL);
    expect(context.city.simulate).toHaveBeenCalledTimes(1);
    expect(context.sceneManager.update).toHaveBeenCalledWith(context.city);
  });

  it('does not overwrite an existing building', () => {
    const tool = new BuildingTool(BUILDING_TYPE.ROAD);
    const tile = new Tile(0, 0);
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const context = fakeContext();
    const object = { userData: tile } as unknown as THREE.Object3D;

    tool.onTileClick(tile, object, context);

    expect(tile.building?.type).toBe(BUILDING_TYPE.RESIDENTIAL);
    expect(context.city.simulate).not.toHaveBeenCalled();
  });

  it('exposes the building type as its id', () => {
    expect(new BuildingTool(BUILDING_TYPE.INDUSTRIAL).id).toBe(
      BUILDING_TYPE.INDUSTRIAL
    );
  });
});
