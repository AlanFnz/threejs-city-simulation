import { describe, expect, it, vi } from 'vitest';
import { CameraManager } from '.';

describe('CameraManager', () => {
  it('recenters the camera origin on a city tile', () => {
    const gameWindow = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const onFocusChanged = vi.fn();
    const cameraManager = new CameraManager(gameWindow, 16, onFocusChanged);
    const initialPosition = cameraManager.camera.position.clone();

    cameraManager.focusOnTile(2, 7);

    expect(cameraManager.camera.position.x - initialPosition.x).toBeCloseTo(-5.5);
    expect(cameraManager.camera.position.y - initialPosition.y).toBeCloseTo(0);
    expect(cameraManager.camera.position.z - initialPosition.z).toBeCloseTo(-0.5);
    expect(cameraManager.getFocus()).toEqual({ x: 2, y: 7 });
    expect(onFocusChanged).toHaveBeenCalledWith({ x: 2, y: 7 });

    onFocusChanged.mockClear();
    cameraManager.onMouseMove({
      buttons: 2,
      ctrlKey: true,
      movementX: 4,
      movementY: -3,
    } as MouseEvent);

    expect(cameraManager.getFocus()).not.toEqual({ x: 2, y: 7 });
    expect(onFocusChanged).toHaveBeenCalledOnce();
  });
});
