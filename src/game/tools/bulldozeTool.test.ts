import { describe, it, expect, vi } from 'vitest';
import { BulldozeTool } from './bulldozeTool';
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

describe('BulldozeTool', () => {
  it('removes the building, then simulates and re-renders', () => {
    const tool = new BulldozeTool();
    const tile = new Tile(0, 0);
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const context = fakeContext();
    const object = { userData: tile } as unknown as THREE.Object3D;

    tool.onTileClick(tile, object, context);

    expect(tile.building).toBeNull();
    expect(context.city.simulate).toHaveBeenCalledTimes(1);
    expect(context.sceneManager.update).toHaveBeenCalledWith(context.city);
  });

  it('does nothing on an empty tile', () => {
    const tool = new BulldozeTool();
    const tile = new Tile(0, 0);
    const context = fakeContext();
    const object = { userData: tile } as unknown as THREE.Object3D;

    tool.onTileClick(tile, object, context);

    expect(context.city.simulate).not.toHaveBeenCalled();
    expect(context.sceneManager.update).not.toHaveBeenCalled();
  });
});
