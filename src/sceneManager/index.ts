import * as THREE from 'three';
import { ICity } from '../city';
import { ITile } from '../city/tile';
import { AssetManager, IAssetManager } from '../assetManager';
import { ModelKey } from '../assetManager/constants';
import {
  CameraFocus,
  ICameraManager,
  CameraManager,
} from '../cameraManager';
import { VehicleGraph } from '../city/vehicle/vehicleGraph';
import { BUILDING_TYPE } from '../city/building/constants';
import { IRoad } from '../city/building/road';

/** Matrix that collapses an instance to zero volume - InstancedMesh has no
 * per-instance visibility flag, so hiding a tile (terrain under a building,
 * or a freed building pool slot) means scaling its instance to nothing
 * rather than toggling a `visible` property. */
const HIDDEN_INSTANCE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

const WHITE_TINT = new THREE.Color(1, 1, 1);
const ABANDONED_TINT = new THREE.Color(0x707070);

/** Highlights are a lerp toward a target color rather than a multiplicative
 * factor: instanceColor only multiplies the sampled texture (no per-instance
 * emissive like a regular mesh had), and a multiply produces a barely
 * visible shift on already-dark building textures, even though the same
 * factor reads clearly on bright flat grass. A lerp blends by a fixed
 * *amount* regardless of how dark or light the base pixel is, so hover/select
 * stay visible on every building instead of just terrain. */
const HIGHLIGHT_BLENDS: Record<number, { color: THREE.Color; amount: number }> = {
  // Not pure white: a base tint is white for every normal (non-abandoned)
  // instance, and lerping white toward white is a no-op. THREE's color
  // management applies sRGB<->linear conversion around this lerp, which
  // compresses how visible a shift near white ends up looking - a saturated
  // color and a strong amount are both needed for it to read clearly.
  0x555555: { color: new THREE.Color(0.15, 0.55, 1), amount: 0.6 },
  0xaaaa55: { color: new THREE.Color(1, 0.65, 0.05), amount: 0.65 },
};

function applyHighlight(base: THREE.Color, highlightColor: number): THREE.Color {
  const blend = HIGHLIGHT_BLENDS[highlightColor];
  if (!blend) return base.clone();
  return base.clone().lerp(blend.color, blend.amount);
}

const INITIAL_POOL_CAPACITY = 16;

interface BuildingPool {
  mesh: THREE.InstancedMesh;
  capacity: number;
  freeSlots: number[];
  tileAtSlot: (ITile | null)[];
  baseTintAtSlot: THREE.Color[];
}

/** Per-tile record of which pool slot currently renders its building, and
 * the transform/tint it was last given - so a redundant isMeshOutOfDate
 * (e.g. Road recomputes it every tick even when nothing about the tile's
 * connectivity actually changed) can be skipped instead of reallocating. */
interface BuildingSlotRecord {
  modelKey: ModelKey;
  slot: number;
  matrix: THREE.Matrix4;
  abandoned: boolean;
}

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
  private buildingSlots: (BuildingSlotRecord | null)[][] = [];
  private buildingPools: Map<ModelKey, BuildingPool> = new Map();
  private buildingPoolByMesh: Map<THREE.InstancedMesh, BuildingPool> =
    new Map();
  private terrainMesh: THREE.InstancedMesh | null = null;
  private terrainTiles: (ITile | null)[] = [];
  private terrainBaseMatrices: THREE.Matrix4[] = [];
  private terrainHidden: boolean[] = [];
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private activeObject: THREE.Object3D | null;
  private activeInstanceIndex: number | null = null;
  private hoverObject: THREE.Object3D | null;
  private hoverInstanceIndex: number | null = null;
  /** Set by getSelectedObject just before returning an instanced mesh; read
   * synchronously by the setHighlightedMesh/setActiveObject call that follows
   * within the same mouse-event handler, before any other raycast can run. */
  private lastPickedInstanceIndex: number | null = null;
  private vehicleGraph: VehicleGraph = null!;
  private root: THREE.Group = new THREE.Group();
  private previewMesh: THREE.Object3D | null = null;
  private lastFrameTime: number | null = null;
  cameraManager: ICameraManager;

  constructor(
    city: ICity,
    onLoad: () => void,
    onCameraFocusChanged: (focus: CameraFocus) => void = () => undefined
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.scene = new THREE.Scene();
    this.gameWindow = document.getElementById('render-target') as HTMLElement;
    this.assetManager = new AssetManager(() => {
      this.initialize(city);
      onLoad();
    });
    this.cameraManager = new CameraManager(
      this.gameWindow,
      city.size,
      onCameraFocusChanged
    );

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
    this.disposeBuildingPools();
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.vehicleGraph = new VehicleGraph(city, this.assetManager);
    this.root.add(this.vehicleGraph);

    this.buildingSlots = [];
    for (let x = 0; x < city.size; x++) {
      this.buildingSlots.push(new Array(city.size).fill(null));
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
    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        const index = x * city.size + y;
        matrix.makeTranslation(x, 0, y);
        this.terrainBaseMatrices[index] = matrix.clone();
        this.terrainTiles[index] = tile;
        mesh.setMatrixAt(index, tile ? matrix : HIDDEN_INSTANCE_MATRIX);
        mesh.setColorAt(index, WHITE_TINT);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    this.terrainMesh = mesh;
    this.root.add(mesh);
  }

  private disposeBuildingPools(): void {
    for (const pool of this.buildingPools.values()) {
      pool.mesh.geometry.dispose();
    }
    this.buildingPools.clear();
    this.buildingPoolByMesh.clear();
  }

  /**
   * Disposes cloned per-instance materials under an object.
   * Never disposes geometry: building/vehicle geometries are shared references
   * back to AssetManager's cached loaded models, so disposing one instance's
   * geometry would break every other instance of that model still in the scene.
   * (Instance-pool geometries are a one-off bake per pool, not shared with
   * AssetManager's cache, so those are disposed separately - see
   * disposeBuildingPools/setupTerrain.)
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

  private getOrCreateBuildingPool(modelKey: ModelKey): BuildingPool | null {
    const existing = this.buildingPools.get(modelKey);
    if (existing) return existing;

    const mesh = this.assetManager.createModelInstancedMesh(
      modelKey,
      INITIAL_POOL_CAPACITY
    );
    if (!mesh) return null;

    for (let i = 0; i < INITIAL_POOL_CAPACITY; i++) {
      mesh.setMatrixAt(i, HIDDEN_INSTANCE_MATRIX);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const pool: BuildingPool = {
      mesh,
      capacity: INITIAL_POOL_CAPACITY,
      freeSlots: Array.from(
        { length: INITIAL_POOL_CAPACITY },
        (_, i) => INITIAL_POOL_CAPACITY - 1 - i
      ),
      tileAtSlot: new Array(INITIAL_POOL_CAPACITY).fill(null),
      baseTintAtSlot: new Array(INITIAL_POOL_CAPACITY).fill(WHITE_TINT),
    };
    this.buildingPools.set(modelKey, pool);
    this.buildingPoolByMesh.set(mesh, pool);
    this.root.add(mesh);
    return pool;
  }

  /** Doubles a pool's capacity. Growing an InstancedMesh means building a
   * whole new one (its instance buffers are a fixed size at construction), so
   * any outstanding hover/active reference to the old mesh object is
   * repointed to the new one - the instance indices themselves don't change. */
  private growBuildingPool(modelKey: ModelKey, pool: BuildingPool): BuildingPool {
    const newCapacity = pool.capacity * 2;
    const newMesh = this.assetManager.createModelInstancedMesh(
      modelKey,
      newCapacity
    );
    if (!newMesh) return pool;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < pool.capacity; i++) {
      pool.mesh.getMatrixAt(i, matrix);
      newMesh.setMatrixAt(i, matrix);
      if (pool.mesh.instanceColor) {
        color.fromBufferAttribute(pool.mesh.instanceColor, i);
        newMesh.setColorAt(i, color);
      }
    }
    for (let i = pool.capacity; i < newCapacity; i++) {
      newMesh.setMatrixAt(i, HIDDEN_INSTANCE_MATRIX);
    }
    newMesh.instanceMatrix.needsUpdate = true;
    if (newMesh.instanceColor) newMesh.instanceColor.needsUpdate = true;

    this.root.remove(pool.mesh);
    pool.mesh.geometry.dispose();
    this.root.add(newMesh);

    if (this.hoverObject === pool.mesh) this.hoverObject = newMesh;
    if (this.activeObject === pool.mesh) this.activeObject = newMesh;
    this.buildingPoolByMesh.delete(pool.mesh);

    const freeSlots = [...pool.freeSlots];
    for (let i = newCapacity - 1; i >= pool.capacity; i--) freeSlots.push(i);

    const grown: BuildingPool = {
      mesh: newMesh,
      capacity: newCapacity,
      freeSlots,
      tileAtSlot: pool.tileAtSlot.concat(
        new Array(newCapacity - pool.capacity).fill(null)
      ),
      baseTintAtSlot: pool.baseTintAtSlot.concat(
        new Array(newCapacity - pool.capacity).fill(WHITE_TINT)
      ),
    };
    this.buildingPools.set(modelKey, grown);
    this.buildingPoolByMesh.set(newMesh, grown);
    return grown;
  }

  private allocateBuildingSlot(
    modelKey: ModelKey,
    tile: ITile
  ): { pool: BuildingPool; slot: number } | null {
    let pool = this.getOrCreateBuildingPool(modelKey);
    if (!pool) return null;
    if (pool.freeSlots.length === 0) pool = this.growBuildingPool(modelKey, pool);
    if (pool.freeSlots.length === 0) return null;

    const slot = pool.freeSlots.pop() as number;
    pool.tileAtSlot[slot] = tile;
    return { pool, slot };
  }

  private freeBuildingSlot(record: BuildingSlotRecord): void {
    const pool = this.buildingPools.get(record.modelKey);
    if (!pool) return;
    pool.mesh.setMatrixAt(record.slot, HIDDEN_INSTANCE_MATRIX);
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.tileAtSlot[record.slot] = null;
    pool.freeSlots.push(record.slot);
  }

  private setBuildingSlotTransform(
    pool: BuildingPool,
    slot: number,
    matrix: THREE.Matrix4
  ): void {
    pool.mesh.setMatrixAt(slot, matrix);
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  private setBuildingSlotBaseTint(
    pool: BuildingPool,
    slot: number,
    tint: THREE.Color
  ): void {
    pool.baseTintAtSlot[slot] = tint;
    this.refreshInstanceColor(pool.mesh, slot);
  }

  /** Recombines a slot's stored base tint (normal/abandoned) with whatever
   * highlight is currently active on it, if any - hover/active tracking is a
   * single shared pair of (mesh, index) that can point at any pool (or
   * terrain), not just this one, so this has to check against it rather than
   * assume no highlight is active. */
  private refreshInstanceColor(mesh: THREE.InstancedMesh, index: number): void {
    let color = 0x000000;
    if (this.activeObject === mesh && this.activeInstanceIndex === index) {
      color = 0xaaaa55;
    } else if (this.hoverObject === mesh && this.hoverInstanceIndex === index) {
      color = 0x555555;
    }
    const base = this.getInstanceBaseTint(mesh, index);
    mesh.setColorAt(index, applyHighlight(base, color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private getInstanceBaseTint(mesh: THREE.InstancedMesh, index: number): THREE.Color {
    if (mesh === this.terrainMesh) return WHITE_TINT;
    return this.buildingPoolByMesh.get(mesh)?.baseTintAtSlot[index] ?? WHITE_TINT;
  }

  private isInstancedPickable(
    object: THREE.Object3D
  ): object is THREE.InstancedMesh {
    return (
      object === this.terrainMesh ||
      this.buildingPoolByMesh.has(object as THREE.InstancedMesh)
    );
  }

  private resolveInstanceTile(
    mesh: THREE.InstancedMesh,
    index: number
  ): ITile | null {
    if (mesh === this.terrainMesh) return this.terrainTiles[index] ?? null;
    return this.buildingPoolByMesh.get(mesh)?.tileAtSlot[index] ?? null;
  }

  update(city: ICity): void {
    let terrainMatrixChanged = false;

    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        if (!tile) continue;

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

        const existing = this.buildingSlots[x][y];

        if (!tile.building && existing) {
          this.freeBuildingSlot(existing);
          this.buildingSlots[x][y] = null;
          this.vehicleGraph.updateTile(x, y, null);
          continue;
        }

        if (tile.building && tile.building.isMeshOutOfDate) {
          const resolved = this.assetManager.resolveBuildingInstance(tile);

          if (!resolved) {
            if (existing) {
              this.freeBuildingSlot(existing);
              this.buildingSlots[x][y] = null;
            }
          } else {
            const { modelKey, matrix, abandoned } = resolved;
            const unchanged =
              !!existing &&
              existing.modelKey === modelKey &&
              existing.abandoned === abandoned &&
              existing.matrix.equals(matrix);

            if (!unchanged) {
              if (existing && existing.modelKey === modelKey) {
                const pool = this.buildingPools.get(modelKey);
                if (pool) {
                  this.setBuildingSlotTransform(pool, existing.slot, matrix);
                  if (existing.abandoned !== abandoned) {
                    this.setBuildingSlotBaseTint(
                      pool,
                      existing.slot,
                      abandoned ? ABANDONED_TINT : WHITE_TINT
                    );
                  }
                  existing.matrix = matrix;
                  existing.abandoned = abandoned;
                }
              } else {
                if (existing) this.freeBuildingSlot(existing);
                const allocation = this.allocateBuildingSlot(modelKey, tile);
                if (allocation) {
                  const { pool, slot } = allocation;
                  this.setBuildingSlotTransform(pool, slot, matrix);
                  this.setBuildingSlotBaseTint(
                    pool,
                    slot,
                    abandoned ? ABANDONED_TINT : WHITE_TINT
                  );
                  this.buildingSlots[x][y] = { modelKey, slot, matrix, abandoned };
                } else {
                  this.buildingSlots[x][y] = null;
                }
              }
            }
          }

          tile.building.isMeshOutOfDate = false;
          if (tile.building.type === BUILDING_TYPE.ROAD) {
            this.vehicleGraph.updateTile(x, y, tile.building as unknown as IRoad);
          }
        }
      }
    }

    if (terrainMatrixChanged && this.terrainMesh) {
      this.terrainMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public start(): void {
    this.lastFrameTime = null;
    this.renderer.setAnimationLoop(this.draw.bind(this));
  }

  public stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  private draw(time: number): void {
    const deltaSeconds =
      this.lastFrameTime === null ? 0 : (time - this.lastFrameTime) / 1000;
    this.lastFrameTime = time;
    this.cameraManager.update(deltaSeconds);
    this.vehicleGraph.updateVehicles();
    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  public setHighlightedMesh(mesh: THREE.Mesh | null): void {
    if (
      this.hoverObject &&
      !this.isSamePick(
        this.hoverObject,
        this.hoverInstanceIndex,
        this.activeObject,
        this.activeInstanceIndex
      )
    ) {
      this.setMeshEmission(this.hoverObject, this.hoverInstanceIndex, 0x000000);
    }
    this.hoverObject = mesh;
    this.hoverInstanceIndex =
      mesh && this.isInstancedPickable(mesh) ? this.lastPickedInstanceIndex : null;
    // Skip re-applying hover tint over the active selection's tint - without
    // this, hovering the currently-selected tile (which a click's own
    // synthetic mousemove does immediately) downgrades its look from
    // selected to merely hovered until the mouse moves off and back.
    if (
      this.hoverObject &&
      !this.isSamePick(
        this.hoverObject,
        this.hoverInstanceIndex,
        this.activeObject,
        this.activeInstanceIndex
      )
    ) {
      this.setMeshEmission(this.hoverObject, this.hoverInstanceIndex, 0x555555);
    }
  }

  /** Two picks are the same target only if they're the same object AND, for
   * a shared InstancedMesh (terrain or a building pool), the same instance. */
  private isSamePick(
    objectA: THREE.Object3D | null,
    indexA: number | null,
    objectB: THREE.Object3D | null,
    indexB: number | null
  ): boolean {
    if (objectA !== objectB) return false;
    if (objectA && this.isInstancedPickable(objectA)) return indexA === indexB;
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
    instanceIndex: number | null,
    color: number
  ): void {
    if (!mesh) return;
    if (this.isInstancedPickable(mesh)) {
      if (instanceIndex === null) return;
      this.refreshInstanceColorWithHighlight(mesh, instanceIndex, color);
      return;
    }
    if (!(mesh instanceof THREE.Mesh)) return;
    mesh.material.emissive?.setHex(color);
  }

  /** Same combination logic as refreshInstanceColor, but driven by an
   * explicit "apply this highlight color now" call (hover/select changing)
   * rather than "something about the base tint changed". */
  private refreshInstanceColorWithHighlight(
    mesh: THREE.InstancedMesh,
    index: number,
    color: number
  ): void {
    const base = this.getInstanceBaseTint(mesh, index);
    mesh.setColorAt(index, applyHighlight(base, color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
      const object = intersection.object;
      if (this.isInstancedPickable(object) && intersection.instanceId !== undefined) {
        const tile = this.resolveInstanceTile(object, intersection.instanceId);
        if (!tile) continue;
        object.userData = tile;
        this.lastPickedInstanceIndex = intersection.instanceId;
        return object;
      }
      if (!object.userData.nonInteractive) {
        this.lastPickedInstanceIndex = null;
        return object;
      }
    }
    this.lastPickedInstanceIndex = null;
    return null;
  }

  public setActiveObject(object: THREE.Object3D): void {
    this.deactivateObject();
    this.activeObject = object;
    this.activeInstanceIndex = this.isInstancedPickable(object)
      ? this.lastPickedInstanceIndex
      : null;
    if (this.activeObject)
      this.setMeshEmission(this.activeObject, this.activeInstanceIndex, 0xaaaa55);
  }

  public deactivateObject(): void {
    if (this.activeObject) {
      this.setMeshEmission(this.activeObject, this.activeInstanceIndex, 0x000000);
      this.activeObject = null;
      this.activeInstanceIndex = null;
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
