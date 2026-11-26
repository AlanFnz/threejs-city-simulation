import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { getBuildingFacing } from './frontage';
import { matchRoadVerge } from './roadSurface';
import { createConstructionSite } from './constructionSite';
import { textures } from './textures';
import { ITile } from '../city/tile';
import { IZone } from '../city/building/interfaces';
import { BUILDING_TYPE, BuildingType } from '../city/building/constants';
import { Road, IRoad } from '../city/building/road';
import { ICity } from '../city';
import { models } from './models';
import { ModelEntry, ModelKey, modelType } from './constants';
import { DevelopmentState } from '../city/building/attributes/development';

import { METERS_PER_TILE } from './worldScale';

const DEG2RAD = Math.PI / 180.0;

/** Building types with no zone leveling/styling - a single fixed model at
 * the tile's position. Shared by resolveBuildingInstance and createPreviewMesh
 * instead of a near-duplicate branch per type. */
const FIXED_BUILDING_MODEL_KEYS: Partial<Record<BuildingType, ModelKey>> = {
  [BUILDING_TYPE.POWER_PLANT]: ModelKey.POWER_PLANT,
  [BUILDING_TYPE.POWER_LINE]: ModelKey.POWER_LINE,
  [BUILDING_TYPE.FIRE_STATION]: ModelKey.FIRE_STATION,
  [BUILDING_TYPE.POLICE_STATION]: ModelKey.POLICE_STATION,
  [BUILDING_TYPE.HOSPITAL]: ModelKey.HOSPITAL,
  [BUILDING_TYPE.SCHOOL]: ModelKey.SCHOOL,
};

export interface ResolvedBuildingInstance {
  modelKey: ModelKey;
  matrix: THREE.Matrix4;
  abandoned: boolean;
}

export interface IAssetManager {
  createTerrainInstancedMesh(count: number): THREE.InstancedMesh | null;
  createModelInstancedMesh(
    modelKey: ModelKey,
    count: number
  ): THREE.InstancedMesh | null;
  resolveBuildingInstance(tile: ITile, facing?: number | null): ResolvedBuildingInstance | null;
  createRandomVehicleMesh(): THREE.Mesh | null;
  createPreviewMesh(
    tile: ITile,
    buildingType: BuildingType,
    city: ICity
  ): THREE.Mesh | null;
  textures: Record<string, THREE.Texture>;
}

export class AssetManager implements IAssetManager {
  private siteScales = new Map<ModelKey, THREE.Vector3>();
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
      this.loadModel(modelName as keyof typeof models, meta);
    }

    this.onLoad = onLoad;
  }

  loadModel(
    name: keyof typeof models,
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
            if (models[name].type === modelType.ROAD) {
              matchRoadVerge((obj as THREE.Mesh).geometry);
              material.vertexColors = true;
            }
            (obj as THREE.Mesh).material = material;
            obj.receiveShadow = receiveShadow;
            obj.castShadow = castShadow;
          }
        });

        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, THREE.MathUtils.degToRad(rotation), 0);
        mesh.scale.setScalar(scale / METERS_PER_TILE);

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
   * One InstancedMesh shared by every tile using this model instead of a mesh
   * per tile. Every zone/road/terrain GLB is single mesh/single material, so
   * its geometry is baked with the loaded model's own transform (matrixWorld)
   * so each instance only needs a per-tile placement matrix - reproducing
   * what cloneMesh + per-tile position/rotation used to do, without a
   * per-tile Object3D/material.
   */
  createModelInstancedMesh(
    modelKey: ModelKey,
    count: number
  ): THREE.InstancedMesh | null {
    if (modelKey === ModelKey.FOUNDATIONS || modelKey === ModelKey.STRUCTURAL_FRAME) {
      return createConstructionSite(modelKey === ModelKey.STRUCTURAL_FRAME, count);
    }
    const root = this.loadedModels[modelKey];
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
    const sourceMaterial = (sourceMesh as THREE.Mesh)
      .material as THREE.MeshLambertMaterial;
    const material = sourceMaterial.clone();

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.receiveShadow = (sourceMesh as THREE.Mesh).receiveShadow;
    instancedMesh.castShadow = (sourceMesh as THREE.Mesh).castShadow;
    return instancedMesh;
  }

  /** Tile colors are supplied per instance by SceneManager. */
  createTerrainInstancedMesh(count: number): THREE.InstancedMesh | null {
    const mesh = this.createModelInstancedMesh(ModelKey.GRASS, count);
    if (!mesh) return null;
    (mesh.material as THREE.Material).dispose();
    mesh.material = new THREE.MeshLambertMaterial();
    // GRASS's ModelEntry doesn't set castShadow, so loadModel's default
    // (true) applies to the source mesh - but flat ground was never meant to
    // cast shadows onto itself/neighbors, only receive them.
    mesh.castShadow = false;
    return mesh;
  }

  /**
   * Resolves what a tile's building should look like right now - which
   * model, at what transform, and whether it's abandoned (for the base tint)
   * - without creating a mesh. SceneManager places this into the shared
   * InstancedMesh pool for that model.
   */
  resolveBuildingInstance(tile: ITile, facing?: number | null): ResolvedBuildingInstance | null {
    if (!tile.building) return null;

    const fixedBuildingModelKey = FIXED_BUILDING_MODEL_KEYS[tile.building.type];
    if (fixedBuildingModelKey) {
      return this.resolveFixedBuildingInstance(tile, fixedBuildingModelKey, facing);
    }

    switch (tile.building.type) {
      case BUILDING_TYPE.RESIDENTIAL:
      case BUILDING_TYPE.COMMERCIAL:
      case BUILDING_TYPE.INDUSTRIAL:
        return this.resolveZoneInstance(tile, facing);
      case BUILDING_TYPE.ROAD:
        return this.resolveRoadInstance(tile);
      default:
        console.warn(`Mesh type ${tile.building?.type} is not recognized.`);
        return null;
    }
  }

  private resolveZoneInstance(tile: ITile, facing?: number | null): ResolvedBuildingInstance | null {
    const zone = tile.building as IZone | null;
    if (!zone) {
      throw new Error('Tile does not have a valid building.');
    }

    const development = zone.development;
    const target = this.resolveZoneModelName(zone.type, zone.style, development.targetLevel) as ModelKey;
    let modelKey = target;
    const matrix = new THREE.Matrix4();
    matrix.makeRotationY(facing == null ? (zone.rotation?.y ?? 0) : facing * Math.PI / 2);
    if (development.constructionStage) {
      modelKey = development.constructionStage === 'frame' ? ModelKey.STRUCTURAL_FRAME : ModelKey.FOUNDATIONS;
      let scale = this.siteScales.get(target);
      if (!scale) {
        const size = new THREE.Box3().setFromObject(this.loadedModels[target]).getSize(new THREE.Vector3());
        const clamp = THREE.MathUtils.clamp;
        scale = new THREE.Vector3(clamp(size.x / 0.54, 0.68, 1.12),
          clamp(size.y / 0.61, 0.48, 2.5), clamp(size.z / 0.49, 0.68, 1.12));
        this.siteScales.set(target, scale);
      }
      matrix.scale(new THREE.Vector3(scale.x, modelKey === ModelKey.FOUNDATIONS ? 1 : scale.y, scale.z));
    } else if (development.state === DevelopmentState.UNDEVELOPED) {
      modelKey = ModelKey.UNDER_CONSTRUCTION;
    }
    matrix.setPosition(zone.x, 0, zone.y);

    return {
      modelKey,
      matrix,
      abandoned: zone.development.state === DevelopmentState.ABANDONED,
    };
  }

  /**
   * A zone's level cap (raised by some milestone rewards, e.g. "develop 5
   * commercial zones") can exceed how many distinct level models actually
   * exist for its type/style - resolving straight to a nonexistent key
   * would free the zone's current instance and never allocate a
   * replacement, making the building silently vanish. Walk back down to
   * the highest level that has a real registered model instead.
   */
  private resolveZoneModelName(type: string, style: string, level: number): string {
    for (let candidate = level; candidate >= 1; candidate--) {
      const key = `${type}-${style}${candidate}`;
      if (key in models) return key;
    }
    return `${type}-${style}1`;
  }

  private resolveRoadInstance(tile: ITile): ResolvedBuildingInstance | null {
    const road = tile.building as IRoad | null;
    if (!road) return null;

    const matrix = new THREE.Matrix4();
    matrix.makeRotationY((road.rotation?.y ?? 0) * DEG2RAD);
    matrix.setPosition(tile.x, 0.01, tile.y);

    return {
      modelKey: `${BUILDING_TYPE.ROAD}-${road.style}` as ModelKey,
      matrix,
      abandoned: false,
    };
  }

  /** Shared by every "fixed" building - no zone leveling/styling, just a
   * single model sitting at the tile's position (power plant/line, and the
   * four civic services). */
  private resolveFixedBuildingInstance(
    tile: ITile,
    modelKey: ModelKey,
    facing?: number | null
  ): ResolvedBuildingInstance {
    const matrix = new THREE.Matrix4().makeRotationY((facing ?? 0) * Math.PI / 2);
    matrix.setPosition(tile.x, 0, tile.y);

    return { modelKey, matrix, abandoned: false };
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

    const modelKey = FIXED_BUILDING_MODEL_KEYS[buildingType] ?? ModelKey.UNDER_CONSTRUCTION;
    const mesh = this.cloneMesh(modelKey, true);
    if (!mesh) return null;
    mesh.rotation.y = (getBuildingFacing(city, tile.x, tile.y, buildingType) ?? 0) * Math.PI / 2;
    mesh.position.set(tile.x, 0, tile.y);
    return mesh;
  }
}
