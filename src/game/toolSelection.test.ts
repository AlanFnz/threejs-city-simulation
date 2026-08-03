import { describe, expect, it, vi } from 'vitest';
import { Tile } from '../city/tile';
import { Game } from '.';

vi.mock('../sceneManager', () => ({
  SceneManager: class SceneManager {},
}));

describe('Game tool selection', () => {
  it('closes stale inspector state when a build tool is selected', () => {
    const ui = { update: vi.fn() };
    const sceneManager = {
      deactivateObject: vi.fn(),
      hidePreviewMesh: vi.fn(),
    };
    const game = Object.create(Game.prototype) as Game;

    Object.assign(game, {
      focusedObject: new Tile(2, 3),
      milestoneTracker: { isUnlocked: () => true },
      sceneManager,
      ui,
      lastPreviewTile: new Tile(1, 1),
    });

    game.selectTool('ROAD');

    expect(game.activeToolId).toBe('ROAD');
    expect(game.focusedObject).toBeNull();
    expect(ui.update).toHaveBeenCalledWith({
      activeToolId: 'ROAD',
      inspector: null,
    });
    expect(sceneManager.deactivateObject).toHaveBeenCalledOnce();
    expect(sceneManager.hidePreviewMesh).toHaveBeenCalledOnce();
  });

  it('leaves the current tool and inspector untouched when locked', () => {
    const ui = { update: vi.fn() };
    const sceneManager = {
      deactivateObject: vi.fn(),
      hidePreviewMesh: vi.fn(),
    };
    const focusedObject = new Tile(2, 3);
    const game = Object.create(Game.prototype) as Game;

    Object.assign(game, {
      activeToolId: 'SELECT',
      focusedObject,
      milestoneTracker: { isUnlocked: () => false },
      sceneManager,
      ui,
    });

    game.selectTool('FIRE_STATION');

    expect(game.activeToolId).toBe('SELECT');
    expect(game.focusedObject).toBe(focusedObject);
    expect(ui.update).not.toHaveBeenCalled();
    expect(sceneManager.deactivateObject).not.toHaveBeenCalled();
  });
});
