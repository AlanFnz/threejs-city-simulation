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
    assetManager: {} as GameContext['assetManager'],
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

    const result = tool.onTileClick(tile, object, context);

    expect(result).toEqual({ status: 'applied' });
    expect(tile.building).toBeNull();
    expect(context.city.simulate).toHaveBeenCalledTimes(1);
    expect(context.sceneManager.update).toHaveBeenCalledWith(context.city);
  });

  it('rejects an empty tile without simulating or rendering', () => {
    const tool = new BulldozeTool();
    const tile = new Tile(0, 0);
    const context = fakeContext();
    const object = { userData: tile } as unknown as THREE.Object3D;

    const result = tool.onTileClick(tile, object, context);

    expect(result).toEqual({ status: 'rejected', reason: 'emptyTile' });
    expect(context.city.simulate).not.toHaveBeenCalled();
    expect(context.sceneManager.update).not.toHaveBeenCalled();
  });
});
