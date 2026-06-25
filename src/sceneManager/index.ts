import * as THREE from 'three';
import { ICity } from '../city';
import { AssetManager, IAssetManager } from '../assetManager';
import { ICameraManager, CameraManager } from '../cameraManager';
import { VehicleGraph } from '../city/vehicle/vehicleGraph';
import { BUILDING_TYPE } from '../city/building/constants';

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
  private terrain: THREE.Mesh[][] = [];
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private activeObject: THREE.Object3D | null;
  private hoverObject: THREE.Object3D | null;
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
    this.cameraManager = new CameraManager(this.gameWindow);
    this.buildings = [];
    this.terrain = [];

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
    this.terrain = [];

    for (let x = 0; x < city.size; x++) {
      const column = [];
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        if (tile) {
          const mesh = this.assetManager.createGroundMesh(tile);
          if (!mesh) return
          this.root.add(mesh);
          column.push(mesh);
        }
      }
      this.buildings.push([...Array(city.size)]);
      this.terrain.push(column);
    }

    this.setupLights();
    this.setupGrid(city);
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

  private setupLights(): void {
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(10, 20, 20);
    sun.castShadow = true;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 0;
    sun.shadow.camera.bottom = -10;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 50;
    this.root.add(sun);
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
    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        const existingBuildingMesh = this.buildings[x][y];

        if (tile) {
          this.terrain[x][y].visible = !tile.building?.hideTerrain;

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
    if (this.hoverObject && this.hoverObject !== this.activeObject) {
      this.setMeshEmission(this.hoverObject, 0x000000);
    }
    this.hoverObject = mesh;
    if (this.hoverObject) {
      this.setMeshEmission(this.hoverObject, 0x555555);
    }
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
      if (!(child as THREE.Mesh).isMesh) return;
      const material = (child as THREE.Mesh)
        .material as THREE.MeshLambertMaterial;
      material.color = new THREE.Color(tint);
      material.opacity = 0.55;
      material.depthTest = false;
      child.renderOrder = 999;
    });
    mesh.userData.nonInteractive = true;

    this.root.add(mesh);
    this.previewMesh = mesh;
  }

  public hidePreviewMesh(): void {
    if (!this.previewMesh) return;
    this.disposeMeshMaterials(this.previewMesh);
    this.root.remove(this.previewMesh);
    this.previewMesh = null;
  }

  private setMeshEmission(mesh: THREE.Object3D | null, color: number): void {
    if (!mesh || !(mesh instanceof THREE.Mesh)) return;
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
      if (!intersection.object.userData.nonInteractive) {
        return intersection.object;
      }
    }
    return null;
  }

  public setActiveObject(object: THREE.Object3D): void {
    this.deactivateObject();
    this.activeObject = object;
    if (this.activeObject) this.setMeshEmission(this.activeObject, 0xaaaa55);
  }

  public deactivateObject(): void {
    if (this.activeObject) {
      this.setMeshEmission(this.activeObject, 0x000000);
      this.activeObject = null;
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
