import * as THREE from 'three';
import { createCamera } from '../camera';
import { City } from '../city/constants';
import { createAssetInstance } from '../assets';

export function createScene(citySize: number) {
  // Initial scene setup
  const gameWindow = document.getElementById('render-target');
  if (!gameWindow) {
    console.error('Failed to find the render target element!');
    throw new Error('Failed to find the render target element!');
  }

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7777777);

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight);
  gameWindow.appendChild(renderer.domElement);

  // Create camera
  const camera = createCamera(gameWindow, renderer, citySize);

  if (!camera) {
    console.error('Failed to create camera!');
    throw new Error('Failed to create camera or camera not found');
  }

  // Handle window resizing
  function onWindowResize() {
    if (!gameWindow || !camera) return;
    camera.onWindowResize();
  }

  // Init scene
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedObject: any;

  let terrain: any[] = [];
  let buildings: any[] = [];

  function initScene(city: City) {
    scene.clear();
    buildings = Array.from({ length: city.size }, () =>
      new Array(city.size).fill(undefined)
    );

    for (let x = 0; x < city.size; x++) {
      const column = [];

      for (let y = 0; y < city.size; y++) {
        // Load the mesh/3D object corresponding to the tile at (x,y)
        // Terrain
        const terrainId = city?.data[x][y]?.terrainId;
        if (terrainId) {
          const terrainMesh = createAssetInstance(terrainId, x, y);
          if (terrainMesh) {
            scene.add(terrainMesh);
            column.push(terrainMesh);
          }
        }
      }
      terrain.push(column);
      buildings.push(...Array(city.size).fill(undefined));
    }

    // Add lights
    setupLights();
  }

  function update(city: City) {
    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const currendBuildingId = buildings[x][y]?.userData?.id;
        const newBuildingId = city.data[x][y]?.buildingId;

        // If the player removes a building, remove it from the scene
        if (!newBuildingId && currendBuildingId) {
          scene.remove(buildings[x][y]);
          buildings[x][y] = undefined;
        }

        // If the data model has changed, update the mesh
        if (newBuildingId && newBuildingId !== currendBuildingId) {
          scene.remove(buildings[x][y]);
          buildings[x][y] = createAssetInstance(newBuildingId, x, y);
          scene.add(buildings[x][y]);
        }
      }
    }
  }

  function setupLights() {
    const lights = [
      new THREE.AmbientLight(0xffffff, 0.8),
      new THREE.DirectionalLight(0xffffff, 0.8),
      new THREE.DirectionalLight(0xffffff, 0.8),
      new THREE.DirectionalLight(0xffffff, 0.8),
    ];

    lights[1]?.position?.set(0, 1, 0);
    lights[2]?.position?.set(1, 1, 0);
    lights[3]?.position?.set(0, 1, 1);

    scene.add(...lights);
  }

  // Render and interaction handlers
  function draw() {
    renderer.render(scene, camera.camera);
  }

  function start() {
    window.addEventListener('resize', onWindowResize, false);
    renderer.setAnimationLoop(draw);
  }

  function stop() {
    window.removeEventListener('resize', onWindowResize, false);
    renderer.setAnimationLoop(null);
  }

  function onMouseDown(event: MouseEvent) {
    camera.onMouseDown(event);

    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera.camera);

    let intersections = raycaster.intersectObjects(scene.children, false);

    if (intersections.length > 0) {
      console.log(intersections);
      if (selectedObject) selectedObject.material?.emissive?.setHex(0);
      selectedObject = intersections[0]?.object;
      selectedObject?.material?.emissive?.setHex(0x555555);
    }
  }

  function onMouseUp(event: MouseEvent) {
    camera.onMouseUp(event);
  }

  function onMouseMove(event: MouseEvent) {
    camera.onMouseMove(event);
  }

  function onWheel(event: WheelEvent) {
    camera.onMouseWheel(event);
  }

  function onTouchStart(event: TouchEvent) {
    camera.onTouchStart(event);
  }

  function onTouchMove(event: TouchEvent) {
    camera.onTouchMove(event);
  }

  function onTouchEnd(event: TouchEvent) {
    camera.onTouchEnd(event);
  }

  // Add listeners
  document.addEventListener('mousedown', onMouseDown, false);
  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('mousemove', (event) => onMouseMove(event), false);
  document.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);

  return {
    initScene,
    start,
    stop,
    update,
  };
}

