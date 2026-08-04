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

  it('pans smoothly with held camera-relative WASD input', () => {
    const gameWindow = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const onFocusChanged = vi.fn();
    const cameraManager = new CameraManager(gameWindow, 16, onFocusChanged);
    const initialFocus = cameraManager.getFocus();

    cameraManager.onKeyDown({
      code: 'KeyW',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);
    cameraManager.update(0.1);

    expect(cameraManager.getFocus()).not.toEqual(initialFocus);
    expect(onFocusChanged).toHaveBeenCalledOnce();

    cameraManager.onKeyUp({ code: 'KeyW' } as KeyboardEvent);
    const stoppedFocus = cameraManager.getFocus();
    cameraManager.update(0.1);
    expect(cameraManager.getFocus()).toEqual(stoppedFocus);
  });

  it('normalizes diagonal movement and clears held input on blur', () => {
    const gameWindow = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const straight = new CameraManager(gameWindow, 16);
    const diagonal = new CameraManager(gameWindow, 16);
    const initialFocus = straight.getFocus();
    const press = (manager: CameraManager, code: string) =>
      manager.onKeyDown({
        code,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);

    press(straight, 'KeyW');
    press(diagonal, 'KeyW');
    press(diagonal, 'KeyD');
    straight.update(0.1);
    diagonal.update(0.1);

    const distanceFromStart = (manager: CameraManager) => {
      const focus = manager.getFocus();
      return Math.hypot(
        focus.x - initialFocus.x,
        focus.y - initialFocus.y
      );
    };
    expect(distanceFromStart(diagonal)).toBeCloseTo(
      distanceFromStart(straight)
    );

    diagonal.clearKeyboardState();
    const stoppedFocus = diagonal.getFocus();
    diagonal.update(0.1);
    expect(diagonal.getFocus()).toEqual(stoppedFocus);
  });

  it('ignores camera keys while typing or using modified shortcuts', () => {
    const gameWindow = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const cameraManager = new CameraManager(gameWindow, 16);
    const initialFocus = cameraManager.getFocus();
    const typingPreventDefault = vi.fn();
    const modifiedPreventDefault = vi.fn();

    cameraManager.onKeyDown({
      code: 'KeyW',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: { closest: () => ({}) },
      preventDefault: typingPreventDefault,
    } as unknown as KeyboardEvent);
    cameraManager.onKeyDown({
      code: 'KeyD',
      altKey: false,
      ctrlKey: true,
      metaKey: false,
      preventDefault: modifiedPreventDefault,
    } as unknown as KeyboardEvent);
    cameraManager.update(0.1);

    expect(cameraManager.getFocus()).toEqual(initialFocus);
    expect(typingPreventDefault).not.toHaveBeenCalled();
    expect(modifiedPreventDefault).not.toHaveBeenCalled();
  });

  it('rotates smoothly with Q and E without changing camera focus', () => {
    const gameWindow = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const onFocusChanged = vi.fn();
    const cameraManager = new CameraManager(gameWindow, 16, onFocusChanged);
    const initialFocus = cameraManager.getFocus();
    const initialPosition = cameraManager.camera.position.clone();
    const press = (code: string) =>
      cameraManager.onKeyDown({
        code,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);

    press('KeyQ');
    cameraManager.update(0.1);
    const rotatedPosition = cameraManager.camera.position.clone();
    expect(rotatedPosition.equals(initialPosition)).toBe(false);
    expect(cameraManager.getFocus()).toEqual(initialFocus);
    expect(onFocusChanged).not.toHaveBeenCalled();

    cameraManager.onKeyUp({ code: 'KeyQ' } as KeyboardEvent);
    press('KeyE');
    cameraManager.update(0.1);
    expect(cameraManager.camera.position.x).toBeCloseTo(initialPosition.x);
    expect(cameraManager.camera.position.y).toBeCloseTo(initialPosition.y);
    expect(cameraManager.camera.position.z).toBeCloseTo(initialPosition.z);
  });
});
