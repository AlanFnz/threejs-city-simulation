import { BUILDING_TYPE } from '../city/building/constants';
import { ISceneManager } from '../sceneManager';

function isActiveToolIdValid(
  toolId: string
): toolId is keyof typeof BUILDING_TYPE {
  return Object.values(BUILDING_TYPE).includes(toolId as any);
}

export function setupEventListeners(
  sceneManager: ISceneManager,
  onMouseDown: (event: MouseEvent) => void,
  onMouseMove: (event: MouseEvent) => void,
  onMouseScroll: (event: WheelEvent) => void
) {
  document.addEventListener('wheel', onMouseScroll, {
    passive: false,
  });

  document.addEventListener('mousedown', onMouseDown, false);
  document.addEventListener('mousemove', onMouseMove, false);
  document.addEventListener('keydown', (event) =>
    sceneManager.cameraManager.onKeyDown(event)
  );
  document.addEventListener('keyup', (event) =>
    sceneManager.cameraManager.onKeyUp(event)
  );
  window.addEventListener('blur', () =>
    sceneManager.cameraManager.clearKeyboardState()
  );

  document.addEventListener(
    'contextmenu',
    (event) => event.preventDefault(),
    false
  );

  document.addEventListener(
    'touchstart',
    sceneManager.cameraManager.onTouchStart,
    { passive: false }
  );

  document.addEventListener(
    'touchmove',
    sceneManager.cameraManager.onTouchMove,
    { passive: false }
  );

  document.addEventListener('touchend', sceneManager.cameraManager.onTouchEnd);
}

export { isActiveToolIdValid };
