import { describe, it, expect, vi } from 'vitest';
import { SelectTool } from './selectTool';
import { GameContext } from './tool';
import { Tile } from '../../city/tile';
import { ICity } from '../../city';

function fakeContext(): GameContext & { setFocusedTile: ReturnType<typeof vi.fn> } {
  return {
    city: {} as ICity,
    sceneManager: {
      setActiveObject: vi.fn(),
      update: vi.fn(),
    } as unknown as GameContext['sceneManager'],
    assetManager: {} as GameContext['assetManager'],
    setFocusedTile: vi.fn(),
  };
}

describe('SelectTool', () => {
  it('highlights the clicked mesh and focuses its tile', () => {
    const tool = new SelectTool();
    const tile = new Tile(2, 3);
    const context = fakeContext();
    const object = { userData: tile } as unknown as THREE.Object3D;

    tool.onTileClick(tile, object, context);

    expect(context.sceneManager.setActiveObject).toHaveBeenCalledWith(object);
    expect(context.setFocusedTile).toHaveBeenCalledWith(tile);
  });

  it('has no onDrag override, so the dispatcher falls back to onTileClick', () => {
    const tool = new SelectTool();
    expect(tool.onDrag).toBeUndefined();
  });
});
