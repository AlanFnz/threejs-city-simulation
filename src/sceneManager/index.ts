import * as THREE from 'three';
import { ICity } from '../city';
import { ITile } from '../city/tile';
import { AssetManager, IAssetManager } from '../assetManager';
import { ICameraManager, CameraManager } from '../cameraManager';
import { VehicleGraph } from '../city/vehicle/vehicleGraph';
import { BUILDING_TYPE } from '../city/building/constants';

/** Matrix that collapses a terrain instance to zero volume - InstancedMesh has
 * no per-instance visibility flag, so hiding a tile means scaling its instance
 * to nothing rather than toggling a `visible` property. */
const HIDDEN_INSTANCE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

/** Approximate the old emissive hover/select glow as a multiplicative tint,
 * since InstancedMesh has no per-instance emissive - only instanceColor,
 * which multiplies the sampled texture rather than adding light to it. */
const TERRAIN_TINTS: Record<number, THREE.Color> = {
  0x000000: new THREE.Color(1, 1, 1),
  0x555555: new THREE.Color(1.3, 1.3, 1.1),
  0xaaaa55: new THREE.Color(1.6, 1.6, 0.9),
};

export interface ISceneManager {
  start(): void;
  stop(): void;
  update(city: ICity): void;
  cameraManager: ICameraManager;
  assetManager: IAssetManager;
  getSelectedObject(event: MouseEvent): THREE.Object3D | null;
  setActiveObject(object: THREE.Object3D): void;
  deactivateObject(): void;
  setHighlightedMesh(mesh: THREE.Mesh | null): void;
  showPreviewMesh(mesh: THREE.Object3D, valid: boolean): void;
  hidePreviewMesh(): void;
}

export class SceneManager implements ISceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private gameWindow: HTMLElement;
  assetManager: IAssetManager;
  private buildings: (THREE.Mesh | null)[][];
  private terrainMesh: THREE.InstancedMesh | null = null;
  private terrainTiles: (ITile | null)[] = [];
  private terrainBaseMatrices: THREE.Matrix4[] = [];
  private terrainHidden: boolean[] = [];
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private activeObject: THREE.Object3D | null;
  private activeTerrainIndex: number | null = null;
  private hoverObject: THREE.Object3D | null;
  private hoverTerrainIndex: number | null = null;
  /** Set by getSelectedObject just before returning terrainMesh; read
   * synchronously by the setHighlightedMesh/setActiveObject call that follows
   * within the same mouse-event handler, before any other raycast can run. */
  private lastPickedTerrainIndex: number | null = null;
  private vehicleGraph: VehicleGraph = null!;
  private root: THREE.Group = new THREE.Group();
  private previewMesh: THREE.Object3D | null = null;
  cameraManager: ICameraManager;

  constructor(city: ICity, onLoad: () => void) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.scene = new THREE.Scene();
    this.gameWindow = document.getElementById('render-target') as HTMLElement;
    this.assetManager = new AssetManager(() => {
      this.initialize(city);
      onLoad();
    });
    this.cameraManager = new CameraManager(this.gameWindow, city.size);
    this.buildings = [];

    this.renderer.setSize(
      this.gameWindow.offsetWidth,
      this.gameWindow.offsetHeight
    );
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gameWindow.appendChild(this.renderer.domElement);
    window.addEventListener('resize', this.onResize.bind(this), false);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.activeObject = null;
    this.hoverObject = null;
  }

  private initialize(city: ICity): void {
    this.disposeMeshMaterials(this.root);
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.vehicleGraph = new VehicleGraph(city, this.assetManager);
    this.root.add(this.vehicleGraph);

    this.buildings = [];
    for (let x = 0; x < city.size; x++) {
      this.buildings.push([...Array(city.size)]);
    }

    this.setupTerrain(city);
    this.setupLights(city.size);
    this.setupGrid(city);
  }

  private setupTerrain(city: ICity): void {
    this.terrainMesh?.geometry.dispose();

    const count = city.size * city.size;
    const mesh = this.assetManager.createTerrainInstancedMesh(count);
    if (!mesh) return;

    this.terrainTiles = new Array(count).fill(null);
    this.terrainBaseMatrices = new Array(count);
    this.terrainHidden = new Array(count).fill(false);

    const matrix = new THREE.Matrix4();
    const white = TERRAIN_TINTS[0x000000];
    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        const index = x * city.size + y;
        matrix.makeTranslation(x, 0, y);
        this.terrainBaseMatrices[index] = matrix.clone();
        this.terrainTiles[index] = tile;
        mesh.setMatrixAt(index, tile ? matrix : HIDDEN_INSTANCE_MATRIX);
        mesh.setColorAt(index, white);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    this.terrainMesh = mesh;
    this.root.add(mesh);
  }

  /**
   * Disposes cloned per-instance materials under an object.
   * Never disposes geometry: building/vehicle geometries are shared references
   * back to AssetManager's cached loaded models, so disposing one instance's
   * geometry would break every other instance of that model still in the scene.
   */
  private disposeMeshMaterials(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const material = (child as THREE.Mesh).material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material?.dispose();
      }
    });
  }

  private setupLights(citySize: number): void {
    // The shadow camera used to target the world origin, which is a corner
    // of the grid (tiles span [0, citySize-1]) rather than its center. That
    // was invisible at size 16 only because the old fixed frustum happened
    // to be generous enough to reach past the map anyway; at real scale it
    // clipped shadows well before the far edge. Centering the target on the
    // grid (same point the camera and grid mesh use) and sizing a symmetric
    // frustum around it scales correctly for any map size.
    const center = citySize / 2 - 0.5;
    // Half-extent of the ground's footprint as seen from the light: the
    // frustum is axis-aligned to the light's own view direction, not the
    // world, so it must fit the square's diagonal (citySize/sqrt(2)) rather
    // than just its side, plus margin for tall buildings poking above y=0.
    const halfExtent = citySize * 0.75;

    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(center + 10, 20, center + 20);
    sun.target.position.set(center, 0, center);
    sun.castShadow = true;
    sun.shadow.camera.left = -halfExtent;
    sun.shadow.camera.right = halfExtent;
    sun.shadow.camera.top = halfExtent;
    sun.shadow.camera.bottom = -halfExtent;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    // Distance from the light to its target is fixed at 30 (sqrt(10^2+20^2+20^2));
    // the far plane needs to reach past the target by roughly the map's own
    // extent to cover the far side of the ground from the light's viewpoint.
    sun.shadow.camera.far = citySize + 50;
    this.root.add(sun);
    this.root.add(sun.target);
    this.root.add(new THREE.AmbientLight(0xffffff, 0.2));
  }

  private setupGrid(city: ICity): void {
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: this.assetManager.textures.grid,
      transparent: true,
      opacity: 0.2,
    });

    if (gridMaterial.map) {
      gridMaterial.map.repeat = new THREE.Vector2(city.size, city.size);
      gridMaterial.map.wrapS = THREE.RepeatWrapping;
      gridMaterial.map.wrapT = THREE.RepeatWrapping;
      gridMaterial.map.needsUpdate = true;
    }

    const grid = new THREE.Mesh(
      new THREE.BoxGeometry(city.size, 0.1, city.size),
      gridMaterial
    );
    grid.position.set(city.size / 2 - 0.5, -0.04, city.size / 2 - 0.5);
    grid.userData.nonInteractive = true;
    this.root.add(grid);
  }

  update(city: ICity): void {
    let terrainMatrixChanged = false;

    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        const existingBuildingMesh = this.buildings[x][y];

        if (tile) {
          if (this.terrainMesh) {
            const index = x * city.size + y;
            const hidden = !!tile.building?.hideTerrain;
            if (hidden !== this.terrainHidden[index]) {
              this.terrainMesh.setMatrixAt(
                index,
                hidden ? HIDDEN_INSTANCE_MATRIX : this.terrainBaseMatrices[index]
              );
              this.terrainHidden[index] = hidden;
              terrainMatrixChanged = true;
            }
          }

          if (!tile.building && existingBuildingMesh) {
            this.disposeMeshMaterials(existingBuildingMesh);
            this.root.remove(existingBuildingMesh);
            this.buildings[x][y] = null;
            this.vehicleGraph.updateTile(x, y, null);
          }

          if (tile.building && tile.building.isMeshOutOfDate) {
            if (existingBuildingMesh) {
              this.disposeMeshMaterials(existingBuildingMesh);
              this.root.remove(existingBuildingMesh);
            }
            this.buildings[x][y] = this.assetManager.createBuildingMesh(tile);
            if (this.buildings[x][y] !== null)
              this.root.add(this.buildings[x][y] as THREE.Object3D);
            tile.building.isMeshOutOfDate = false;
            if (tile.building.type === BUILDING_TYPE.ROAD)
              this.vehicleGraph.updateTile(x, y, tile.building);
          }
        }
      }
    }

    if (terrainMatrixChanged && this.terrainMesh) {
      this.terrainMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public start(): void {
    this.renderer.setAnimationLoop(this.draw.bind(this));
  }

  public stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  private draw(): void {
    this.vehicleGraph.updateVehicles();
    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  public setHighlightedMesh(mesh: THREE.Mesh | null): void {
    if (
      this.hoverObject &&
      !this.isSamePick(
        this.hoverObject,
        this.hoverTerrainIndex,
        this.activeObject,
        this.activeTerrainIndex
      )
    ) {
      this.setMeshEmission(this.hoverObject, this.hoverTerrainIndex, 0x000000);
    }
    this.hoverObject = mesh;
    this.hoverTerrainIndex =
      mesh === this.terrainMesh ? this.lastPickedTerrainIndex : null;
    if (this.hoverObject) {
      this.setMeshEmission(this.hoverObject, this.hoverTerrainIndex, 0x555555);
    }
  }

  /** Two picks are the same target only if they're the same object AND,
   * for the shared terrain InstancedMesh, the same tile instance. */
  private isSamePick(
    objectA: THREE.Object3D | null,
    terrainIndexA: number | null,
    objectB: THREE.Object3D | null,
    terrainIndexB: number | null
  ): boolean {
    if (objectA !== objectB) return false;
    if (objectA === this.terrainMesh) return terrainIndexA === terrainIndexB;
    return true;
  }

  /**
   * Shows a translucent ghost of a not-yet-placed building, tinted by
   * validity. An invalid ghost sits at the same position as whatever's
   * already on that tile, so depth testing is disabled and render order
   * bumped - otherwise the opaque real building in front would win the
   * depth test and hide the very ghost meant to warn "can't build here".
   */
  public showPreviewMesh(mesh: THREE.Object3D, valid: boolean): void {
    this.hidePreviewMesh();

    const tint = valid ? 0x33cc33 : 0xcc3333;
    mesh.traverse((child) => {
      // The raycaster reports the specific child hit, not this top-level
      // container, so every descendant needs the flag - otherwise the ghost
      // can intercept its own raycast, read as "no tile", hide itself, get
      // out of the way, reappear, and repeat: a flicker every frame.
      child.userData.nonInteractive = true;
      if (!(child as THREE.Mesh).isMesh) return;
      const material = (child as THREE.Mesh)
        .material as THREE.MeshLambertMaterial;
      material.color = new THREE.Color(tint);
      material.opacity = 0.55;
      material.depthTest = false;
      child.renderOrder = 999;
    });

    this.root.add(mesh);
    this.previewMesh = mesh;
  }

  public hidePreviewMesh(): void {
    if (!this.previewMesh) return;
    this.disposeMeshMaterials(this.previewMesh);
    this.root.remove(this.previewMesh);
    this.previewMesh = null;
  }

  private setMeshEmission(
    mesh: THREE.Object3D | null,
    terrainIndex: number | null,
    color: number
  ): void {
    if (!mesh) return;
    if (mesh === this.terrainMesh) {
      if (terrainIndex === null) return;
      const tint = TERRAIN_TINTS[color] ?? TERRAIN_TINTS[0x000000];
      this.terrainMesh.setColorAt(terrainIndex, tint);
      if (this.terrainMesh.instanceColor)
        this.terrainMesh.instanceColor.needsUpdate = true;
      return;
    }
    if (!(mesh instanceof THREE.Mesh)) return;
    mesh.material.emissive?.setHex(color);
  }

  public getSelectedObject(event: MouseEvent): THREE.Object3D | null {
    this.mouse.x =
      (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y =
      -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.cameraManager.camera);
    const intersections = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );
    for (const intersection of intersections) {
      if (
        this.terrainMesh &&
        intersection.object === this.terrainMesh &&
        intersection.instanceId !== undefined
      ) {
        const tile = this.terrainTiles[intersection.instanceId];
        if (!tile) continue;
        this.terrainMesh.userData = tile;
        this.lastPickedTerrainIndex = intersection.instanceId;
        return this.terrainMesh;
      }
      if (!intersection.object.userData.nonInteractive) {
        this.lastPickedTerrainIndex = null;
        return intersection.object;
      }
    }
    this.lastPickedTerrainIndex = null;
    return null;
  }

  public setActiveObject(object: THREE.Object3D): void {
    this.deactivateObject();
    this.activeObject = object;
    this.activeTerrainIndex =
      object === this.terrainMesh ? this.lastPickedTerrainIndex : null;
    if (this.activeObject)
      this.setMeshEmission(this.activeObject, this.activeTerrainIndex, 0xaaaa55);
  }

  public deactivateObject(): void {
    if (this.activeObject) {
      this.setMeshEmission(this.activeObject, this.activeTerrainIndex, 0x000000);
      this.activeObject = null;
      this.activeTerrainIndex = null;
    }
  }

  private onResize(): void {
    this.cameraManager.onWindowResize(this.gameWindow);
    this.renderer.setSize(
      this.gameWindow.clientWidth,
      this.gameWindow.clientHeight
    );
  }
}
