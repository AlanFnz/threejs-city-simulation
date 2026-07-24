import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { textures } from './textures';
import { ITile } from '../city/tile';
import { IZone } from '../city/building/interfaces';
import { BUILDING_TYPE, BuildingType } from '../city/building/constants';
import { Road } from '../city/building/road';
import { ICity } from '../city';
import { models } from './models';
import { ModelEntry, ModelKey, modelType } from './constants';
import { DevelopmentState } from '../city/building/attributes/development';

const DEG2RAD = Math.PI / 180.0;

export interface IAssetManager {
  createTerrainInstancedMesh(count: number): THREE.InstancedMesh | null;
  createBuildingMesh(tile: ITile): THREE.Mesh | null;
  createRandomVehicleMesh(): THREE.Mesh | null;
  createPreviewMesh(
    tile: ITile,
    buildingType: BuildingType,
    city: ICity
  ): THREE.Mesh | null;
  textures: Record<string, THREE.Texture>;
}

export class AssetManager implements IAssetManager {
  private gltfLoader = new GLTFLoader();
  private onLoad: () => void = () => {};
  private modelCount: number = 0;
  private loadedModelCount: number = 0;
  private loadedModels: Record<ModelKey, THREE.Mesh> = {} as Record<
    ModelKey,
    THREE.Mesh
  >;

  public textures: Record<string, THREE.Texture> = {
    grass: textures.GRASS,
    base: textures.BASE,
    grid: textures.GRID,
    specular: textures.SPECULAR,
  };

  constructor(onLoad: () => void) {
    this.modelCount = Object.keys(models).length;
    this.loadedModelCount = 0;

    for (const [modelName, meta] of Object.entries(models)) {
      this.loadModel(modelName as ModelKey, meta);
    }

    this.onLoad = onLoad;
  }

  loadModel(
    name: ModelKey,
    {
      file,
      scale = 1,
      rotation = 0,
      receiveShadow = true,
      castShadow = true,
    }: ModelEntry
  ): void {
    this.gltfLoader.load(
      file,
      (glb) => {
        console.log(`Loaded file: ${file}`);
        const mesh: THREE.Object3D = glb.scene;

        mesh.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const material = new THREE.MeshLambertMaterial({
              map: this.textures.base,
              specularMap: this.textures.specular,
            });
            (obj as THREE.Mesh).material = material;
            obj.receiveShadow = receiveShadow;
            obj.castShadow = castShadow;
          }
        });

        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, THREE.MathUtils.degToRad(rotation), 0);
        mesh.scale.set(scale / 30, scale / 30, scale / 30);

        this.loadedModels[name] = mesh as THREE.Mesh;

        this.loadedModelCount++;
        if (this.loadedModelCount === this.modelCount) {
          this.onLoad();
        }
      },
      (xhr) => {
        console.log(`${name} ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error(error);
      }
    );
  }

  cloneMesh(
    name: ModelKey,
    transparent: boolean | undefined = false,
    receivedMaterial: THREE.MeshLambertMaterial | undefined = undefined
  ): THREE.Mesh | null {
    const originalMesh = this.loadedModels[name];
    if (!originalMesh) return null;

    const mesh = originalMesh.clone() as THREE.Mesh;

    mesh.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const meshObj = obj as THREE.Mesh;
        if (receivedMaterial) {
          meshObj.material = Array.isArray(meshObj.material)
            ? meshObj.material.map(() => receivedMaterial.clone())
            : receivedMaterial.clone();
        } else {
          meshObj.material = Array.isArray(meshObj.material)
            ? meshObj.material.map((material) => material.clone())
            : (meshObj.material as THREE.Material).clone();
        }

        if (Array.isArray(meshObj.material)) {
          meshObj.material.forEach((material) => {
            (material as THREE.MeshLambertMaterial).transparent = transparent;
          });
        } else {
          (meshObj.material as THREE.MeshLambertMaterial).transparent =
            transparent;
        }
      }
    });

    return mesh;
  }

  /**
   * One InstancedMesh shared by every grass tile instead of a mesh per tile.
   * The GRASS model is a single mesh/material GLB, so its geometry is baked
   * with the loaded model's own transform (matrixWorld) so each instance only
   * needs a per-tile translation - reproducing what createGroundMesh used to
   * do per-tile, without per-tile Object3D/material overhead.
   */
  createTerrainInstancedMesh(count: number): THREE.InstancedMesh | null {
    const root = this.loadedModels[ModelKey.GRASS];
    if (!root) return null;

    let sourceMesh: THREE.Mesh | null = null;
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      if (!sourceMesh && (obj as THREE.Mesh).isMesh) {
        sourceMesh = obj as THREE.Mesh;
      }
    });
    if (!sourceMesh) return null;

    const geometry = (sourceMesh as THREE.Mesh).geometry
      .clone()
      .applyMatrix4((sourceMesh as THREE.Mesh).matrixWorld);

    const texture = this.textures.grass.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.needsUpdate = true;
    const material = new THREE.MeshLambertMaterial({
      map: texture,
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.receiveShadow = true;
    return instancedMesh;
  }

  createBuildingMesh(tile: ITile): THREE.Mesh | null {
    if (!tile.building) return null;

    switch (tile.building.type) {
      case BUILDING_TYPE.RESIDENTIAL:
      case BUILDING_TYPE.COMMERCIAL:
      case BUILDING_TYPE.INDUSTRIAL:
        return this.createZoneMesh(tile);
      case BUILDING_TYPE.ROAD:
        return this.createRoadMesh(tile);
      default:
        console.warn(`Mesh type ${tile.building?.type} is not recognized.`);
        return null;
    }
  }

  private createZoneMesh(tile: ITile): THREE.Mesh | null {
    const zone = tile.building as IZone | null;
    if (!zone) {
      throw new Error('Tile does not have a valid building.');
    }

    let modelName: string;
    switch (zone.development.state) {
      case DevelopmentState.UNDER_CONSTRUCTION:
      case DevelopmentState.UNDEVELOPED:
        modelName = 'UNDER-CONSTRUCTION';
        break;
      default:
        modelName = `${zone.type}-${zone.style}${zone.development.level}`;
        break;
    }

    const mesh = this.cloneMesh(modelName as ModelKey);
    if (!mesh) return null;
    mesh.traverse((obj) => (obj.userData = tile));
    mesh.rotation.set(0, (zone.rotation?.y || 0) * DEG2RAD, 0);
    mesh.position.set(zone.x, 0, zone.y);

    if (zone.development.state === DevelopmentState.ABANDONED) {
      mesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const material = (obj as THREE.Mesh)
            .material as THREE.MeshLambertMaterial;
          material.color = new THREE.Color(0x707070);
        }
      });
    }

    return mesh;
  }

  private createRoadMesh(tile: ITile): THREE.Mesh | null {
    const road = tile.building;
    if (!road) return null;
    const mesh = this.cloneMesh(`${road.type}-${road.style}` as ModelKey);
    if (!mesh) return null;
    mesh.traverse((obj) => (obj.userData = tile));
    if (road.rotation?.y !== undefined) {
      mesh.rotation.set(0, road.rotation.y * DEG2RAD, 0);
    }
    mesh.position.set(road.x, 0.01, road.y);
    mesh.receiveShadow = true;
    return mesh;
  }

  createRandomVehicleMesh(): THREE.Mesh | null {
    const types = Object.entries(models)
      .filter(([_, model]) => model.type === modelType.VEHICLE)
      .map(([key]) => key as ModelKey);

    const i = Math.floor(types.length * Math.random());
    return this.cloneMesh(types[i], true);
  }

  /**
   * A translucent, un-attached preview of what placing buildingType at tile
   * would look like. For roads, a throwaway Road is simulated against the
   * real city (never inserted into the grid) so the ghost shows the correct
   * connector style for the tile's actual current neighbors.
   */
  createPreviewMesh(
    tile: ITile,
    buildingType: BuildingType,
    city: ICity
  ): THREE.Mesh | null {
    if (buildingType === BUILDING_TYPE.ROAD) {
      const road = new Road(tile.x, tile.y);
      road.simulate(city);
      const mesh = this.cloneMesh(`${road.type}-${road.style}` as ModelKey, true);
      if (!mesh) return null;
      mesh.rotation.set(0, road.rotation.y * DEG2RAD, 0);
      mesh.position.set(tile.x, 0.01, tile.y);
      return mesh;
    }

    // RESIDENTIAL/COMMERCIAL/INDUSTRIAL all start out under construction.
    const mesh = this.cloneMesh('UNDER-CONSTRUCTION' as ModelKey, true);
    if (!mesh) return null;
    mesh.position.set(tile.x, 0, tile.y);
    return mesh;
  }
}
