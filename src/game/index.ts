import buildingFactory from '../buildings';
import { createScene } from '../scene';
import { createCity } from '../city';
import { CITY_SIZE, Game } from './constants';
import { BULLDOZE_ID, createToolbarButtons } from '../ui';
import { Tile } from '../city/constants';

export function createGame(): Game {
  let selectedControl: HTMLElement | null =
    document.getElementById('button-select');
  let activeToolId: string | null = 'select';
  let isPaused = false;
  let lastMove: any = new Date(); // Last time mouse was moved
  const scene = createScene(CITY_SIZE);
  const city = createCity(CITY_SIZE);
  createToolbarButtons();

  function update() {
    if (isPaused) return;
    // Update the city data model first, then update the scene
    city.update();
    scene.update(city);
  }

  // Hookup event listeners
  document.addEventListener('mousedown', onMouseDown, false);
  document.addEventListener('mouseup', scene.cameraManager.onMouseUp, false);
  document.addEventListener('mousemove', (event) => onMouseMove(event), false);
  document.addEventListener('wheel', scene.cameraManager.onMouseWheel, {
    passive: false,
  });
  document.addEventListener('touchstart', scene.cameraManager.onTouchStart, {
    passive: false,
  });
  document.addEventListener('touchmove', scene.cameraManager.onTouchMove, {
    passive: false,
  });
  document.addEventListener('touchend', scene.cameraManager.onTouchEnd);
  window.addEventListener('resize', scene.onWindowResize, false);

  // Prevent context menu from popping up
  document.addEventListener(
    'contextmenu',
    (event) => event.preventDefault(),
    false
  );

  function onMouseDown(event: MouseEvent) {
    // Check if left mouse button pressed
    if (event.button === 0) {
      const selectedObject = scene.getSelectedObject(event);
      useActiveTool(selectedObject);
    }

    scene.cameraManager.onMouseDown(event);
  }

  function onMouseMove(event: MouseEvent) {
    // Throttle event handler so it doesn't kill the browser
    if (Date.now() - lastMove < 1 / 60.0) return;
    lastMove = Date.now();

    // Get the object the mouse is currently hovering over
    const hoverObject = scene.getSelectedObject(event);

    scene.setHighlightedObject(hoverObject);

    // If left mouse-button is down, use the tool as well
    if (hoverObject && event.buttons & 1) {
      useActiveTool(hoverObject);
    }

    scene.cameraManager.onMouseMove(event);
  }

  function togglePause() {
    isPaused = !isPaused;
    const pauseButton = document.getElementById('button-pause');
    if (pauseButton) pauseButton.innerHTML = isPaused ? 'RESUME' : 'PAUSE';
  }

  function onToolSelected(event: MouseEvent) {
    if (event.target instanceof HTMLElement) {
      if (selectedControl) selectedControl.classList.remove('selected');
      selectedControl = event.target;
      selectedControl?.classList.add('selected');
      activeToolId = selectedControl?.getAttribute('data-type');
    }
  }

  function useActiveTool(object: any) {
    if (!object) {
      updateInfoPanel(null);
      return;
    }

    const { x, y } = object.userData;
    const tile = city.tiles[x][y];

    // If bulldoze is active, delete the building
    if (activeToolId === 'select') {
      scene.setActiveObject(object);
      updateInfoPanel(tile);
    } else if (activeToolId === 'bulldoze') {
      bulldoze(tile);
      // Otherwise, place the building if this tile doesn't have one
    } else if (!tile.building) {
      placeBuilding(tile);
    }
  }

  function updateInfoPanel(tile: Tile | null) {
    const selectedObjectInfo = document.getElementById('selected-object-info');
    if (selectedObjectInfo)
      selectedObjectInfo.innerHTML = tile ? JSON.stringify(tile, null, 2) : '';
  }

  function bulldoze(tile: Tile) {
    tile.building = undefined;
    scene.update(city);
  }

  function placeBuilding(tile: Tile) {
    if (activeToolId) {
      tile.building = buildingFactory[activeToolId]();
      scene.update(city);
    }
  }

  setInterval(() => {
    update();
  }, 1000);

  if (scene) {
    scene.start();
    scene.initScene(city);
    scene.setOnObjectSelected((selectedObject: any) => {
      const { x, y } = selectedObject?.userData;
      const tile = x && y && city?.tiles[x][y];

      if (tile) {
        if (activeToolId === BULLDOZE_ID && tile.building && tile.building.id) {
          tile.building = undefined;
        } else if (!tile.building && activeToolId) {
          tile.building =
            buildingFactory[activeToolId] && buildingFactory[activeToolId]();
        }
      }

      scene.update(city);
    });
  }

  return {
    update,
    onToolSelected,
    togglePause,
  };
}

