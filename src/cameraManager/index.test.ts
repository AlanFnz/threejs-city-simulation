import { describe, expect, it } from 'vitest';
import { CameraManager } from '.';

describe('CameraManager', () => {
  it('recenters the camera origin on a city tile', () => {
    const gameWindow = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const cameraManager = new CameraManager(gameWindow, 16);
    const initialPosition = cameraManager.camera.position.clone();

    cameraManager.focusOnTile(2, 7);

    expect(cameraManager.camera.position.x - initialPosition.x).toBeCloseTo(-5.5);
    expect(cameraManager.camera.position.y - initialPosition.y).toBeCloseTo(0);
    expect(cameraManager.camera.position.z - initialPosition.z).toBeCloseTo(-0.5);
  });
});
