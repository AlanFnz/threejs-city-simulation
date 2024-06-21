import * as THREE from 'three';
import UNDER_CONSTRUCTION_MODEL from './models/under_construction.gltf';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { textures } from './textures';
import { ITile } from '../city/tile';
import { IZone } from '../city/building/interfaces';
import { BUILDING_TYPE } from '../city/building/constants';
import { models } from './models';
import { ModelEntry, ModelKey, modelType } from './constants';

const DEG2RAD = Math.PI / 180.0;

export interface IAssetManager {
  createGroundMesh(tile: ITile): THREE.Mesh;
  createBuildingMesh(tile: ITile): THREE.Mesh | null;
}

export class AssetManager implements IAssetManager {
  private gltfLoader = new GLTFLoader();
  private cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  private onLoad = () => {};
  private modelCount = 0;
  private loadedModelCount = 0;
  private loadedModels: Record<ModelKey, THREE.Mesh> = {} as Record<
    ModelKey,
    THREE.Mesh
  >;

  private textures: Record<string, THREE.Texture> = {
    grass: textures.GRASS,
    base: textures.BASE,
    specular: textures.SPECULAR,
  };

  constructor(onLoad: any) {
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
      filename,
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
        let mesh = (glb.scene.children[0] as THREE.Object3D)
          .children[0] as THREE.Mesh;

        if (!mesh.isMesh) {
          console.error(`Model ${name} does not contain a mesh.`);
          return;
        }

        mesh.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            (node as THREE.Mesh).material = new THREE.MeshLambertMaterial({
              map: this.textures.base,
              specularMap: this.textures.specular,
            });
          }
        });

        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, THREE.MathUtils.degToRad(rotation), 0);
        mesh.scale.set(scale / 30, scale / 30, scale / 30);
        mesh.receiveShadow = receiveShadow;
        mesh.castShadow = castShadow;

        this.loadedModels[name] = mesh;

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

  cloneMesh(name: ModelKey, transparent = false): THREE.Mesh | null {
    const mesh = this.loadedModels[name]?.clone() as THREE.Mesh;
    if (!mesh) return null;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : (mesh.material as THREE.Material).clone();

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => {
        (material as THREE.MeshLambertMaterial).transparent = transparent;
      });
    } else {
      (mesh.material as THREE.MeshLambertMaterial).transparent = transparent;
    }

    return mesh;
  }

  createGroundMesh(tile: ITile): THREE.Mesh {
    const material = new THREE.MeshLambertMaterial({
      map: this.textures['grass'],
    });
    const mesh = new THREE.Mesh(this.cubeGeometry, material);
    mesh.userData = tile;
    mesh.position.set(tile.x, -0.5, tile.y);
    mesh.receiveShadow = true;
    return mesh;
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

    const modelName = `${zone.type}-${zone.style}${zone.level}`;
    if (zone.developed) {
      // TODO:  modelName = 'under-construction';
    }

    let mesh = this.cloneMesh(modelName as ModelKey);
    if (!mesh) return null;
    mesh.userData = tile;
    mesh.rotation.set(0, (zone.rotation || 0) * DEG2RAD, 0);
    mesh.position.set(zone.x, 0, zone.y);

    if (zone.abandoned) {
      const material = mesh.material as THREE.MeshLambertMaterial;
      material.color = new THREE.Color(0x707070);
    }

    return mesh;
  }

  private createRoadMesh(tile: ITile): THREE.Mesh | null {
    const road = tile.building;
    if (!road) return null;
    const mesh = this.cloneMesh(`${road.type}-${road.style}` as ModelKey);
    if (!mesh) return null;
    mesh.userData = tile;
    if (road.rotation) mesh.rotation.set(0, road.rotation * DEG2RAD, 0);
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
}

