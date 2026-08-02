import { describe, it, expect, vi } from 'vitest';
import { BuildingTool } from './buildingTool';
import { GameContext } from './tool';
import { Tile } from '../../city/tile';
import { BUILDING_TYPE } from '../../city/building/constants';
import { ICity } from '../../city';

function fakeContext(canAfford: boolean = true): GameContext {
  return {
    city: {
      simulate: vi.fn(),
      spend: vi.fn(() => canAfford),
      canAfford: vi.fn(() => canAfford),
    } as unknown as ICity,
    sceneManager: { update: vi.fn() } as unknown as GameContext['sceneManager'],
    assetManager: {
      createPreviewMesh: vi.fn(),
    } as unknown as GameContext['assetManager'],
    setFocusedTile: vi.fn(),
  };
}

describe('BuildingTool', () => {
  it('places its building type on an empty tile, then simulates and re-renders', () => {
    const tool = new BuildingTool(BUILDING_TYPE.COMMERCIAL);
    const tile = new Tile(1, 1);
    const context = fakeContext();
    const object = { userData: tile } as unknown as THREE.Object3D;

    const result = tool.onTileClick(tile, object, context);

    expect(result).toEqual({ status: 'applied' });
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

    const result = tool.onTileClick(tile, object, context);

    expect(result).toEqual({ status: 'rejected', reason: 'occupiedTile' });
    expect(tile.building?.type).toBe(BUILDING_TYPE.RESIDENTIAL);
    expect(context.city.simulate).not.toHaveBeenCalled();
  });

  it('exposes the building type as its id', () => {
    expect(new BuildingTool(BUILDING_TYPE.INDUSTRIAL).id).toBe(
      BUILDING_TYPE.INDUSTRIAL
    );
  });

  it('does not place or simulate when the city cannot afford the cost', () => {
    const tool = new BuildingTool(BUILDING_TYPE.RESIDENTIAL);
    const tile = new Tile(3, 3);
    const context = fakeContext(false);
    const object = { userData: tile } as unknown as THREE.Object3D;

    const result = tool.onTileClick(tile, object, context);

    expect(result).toEqual({
      status: 'rejected',
      reason: 'insufficientFunds',
    });
    expect(tile.building).toBeFalsy();
    expect(context.city.spend).toHaveBeenCalled();
    expect(context.city.simulate).not.toHaveBeenCalled();
  });
});

describe('BuildingTool.getPreview', () => {
  it('asks the asset manager for a preview mesh of its own building type', () => {
    const tool = new BuildingTool(BUILDING_TYPE.RESIDENTIAL);
    const tile = new Tile(2, 4);
    const context = fakeContext();
    const fakeMesh = {} as THREE.Object3D;
    vi.mocked(context.assetManager.createPreviewMesh).mockReturnValue(
      fakeMesh as never
    );

    const preview = tool.getPreview(tile, context);

    expect(context.assetManager.createPreviewMesh).toHaveBeenCalledWith(
      tile,
      BUILDING_TYPE.RESIDENTIAL,
      context.city
    );
    expect(preview).toEqual({ mesh: fakeMesh, valid: true });
  });

  it('marks the preview invalid when the tile is already occupied', () => {
    const tool = new BuildingTool(BUILDING_TYPE.ROAD);
    const tile = new Tile(0, 0);
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const context = fakeContext();
    const fakeMesh = {} as THREE.Object3D;
    vi.mocked(context.assetManager.createPreviewMesh).mockReturnValue(
      fakeMesh as never
    );

    const preview = tool.getPreview(tile, context);

    expect(preview).toEqual({ mesh: fakeMesh, valid: false });
  });

  it('returns null when the asset manager has no mesh to offer yet', () => {
    const tool = new BuildingTool(BUILDING_TYPE.COMMERCIAL);
    const tile = new Tile(0, 0);
    const context = fakeContext();
    vi.mocked(context.assetManager.createPreviewMesh).mockReturnValue(
      null as never
    );

    expect(tool.getPreview(tile, context)).toBeNull();
  });

  it('marks the preview invalid when the city cannot afford it', () => {
    const tool = new BuildingTool(BUILDING_TYPE.RESIDENTIAL);
    const tile = new Tile(5, 5);
    const context = fakeContext(false);
    const fakeMesh = {} as THREE.Object3D;
    vi.mocked(context.assetManager.createPreviewMesh).mockReturnValue(
      fakeMesh as never
    );

    const preview = tool.getPreview(tile, context);

    expect(preview).toEqual({ mesh: fakeMesh, valid: false });
  });
});
