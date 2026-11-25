import * as THREE from 'three';
import { ModelKey } from '../assetManager/constants';
import { ENTRANCES, SIDES } from '../assetManager/frontage';
import { getSidewalkSurface } from '../assetManager/roadSurface';
import { BUILDING_TYPE, type BuildingType } from '../city/building/constants';


interface ConnectionLot {
  modelKey: ModelKey;
  matrix: THREE.Matrix4;
  buildingType: BuildingType;
  facing: number | null;
}

type Lots = (ConnectionLot | null)[][];

function decorativeMesh(material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.visible = false;
  mesh.userData.nonInteractive = true;
  mesh.raycast = () => {};
  return mesh;
}

function replaceGeometry(
  mesh: THREE.Mesh,
  geometry: THREE.BufferGeometry | null
): void {
  mesh.geometry.dispose();
  mesh.geometry = geometry ?? new THREE.BufferGeometry();
  mesh.visible = geometry !== null;
}

function pathWidth(type: BuildingType): number {
  if (type === BUILDING_TYPE.RESIDENTIAL) return 0.105;
  if (type === BUILDING_TYPE.INDUSTRIAL) return 0.22;
  return 0.16;
}

export class CityConnections extends THREE.Group {
  private paths = decorativeMesh(
    new THREE.MeshLambertMaterial({ color: 0xcac1ad })
  );
  private sidewalks = new Map<ModelKey, THREE.Triangle[]>();


  constructor() {
    super();
    this.paths.receiveShadow = true;
    this.add(this.paths);
  }

  updatePaths(
    lots: Lots,
    getGeometry: (key: ModelKey) => THREE.BufferGeometry
  ): void {
    const vertices: number[] = [];
    for (const column of lots)
      for (const road of column) {
        if (road?.buildingType !== BUILDING_TYPE.ROAD) continue;
        let surface = this.sidewalks.get(road.modelKey);
        if (!surface) {
          surface = getSidewalkSurface(getGeometry(road.modelKey));
          this.sidewalks.set(road.modelKey, surface);
        }
      }
    for (const [x, column] of lots.entries()) {
      for (const [y, lot] of column.entries()) {
        if (!lot) continue;
        if (lot.facing === null) continue;
        const entrance = ENTRANCES[lot.modelKey];
        if (!entrance) continue;
        const side = SIDES[lot.facing];
        const road = lots[x + side.x]?.[y + side.y];
        if (road?.buildingType !== BUILDING_TYPE.ROAD) continue;

        const surface = this.sidewalks.get(road.modelKey)!;
        // Start just inside the threshold. Find the actual curb in road-local
        // coordinates, including end caps and both radii of corner models.
        const start = new THREE.Vector3(
          entrance[0],
          0,
          entrance[1] - 0.018
        ).applyMatrix4(lot.matrix);
        const local = start.clone().applyMatrix4(road.matrix.clone().invert());
        const nearest = new THREE.Vector3();
        const candidate = new THREE.Vector3();
        let distance = Infinity;
        for (const triangle of surface) {
          triangle.closestPointToPoint(local, candidate);
          const d = local.distanceToSquared(candidate);
          if (d < distance) {
            nearest.copy(candidate);
            distance = d;
          }
        }
        if (!Number.isFinite(distance)) continue;
        const end = nearest.applyMatrix4(road.matrix);
        start.y = end.y = 0.014;
        const forward = end.clone().sub(start).normalize();
        end.addScaledVector(forward, 0.018);
        const halfWidth = pathWidth(lot.buildingType) / 2;
        const across = new THREE.Vector3(
          forward.z * halfWidth,
          0,
          -forward.x * halfWidth
        );
        const left = start.clone().sub(across),
          right = start.clone().add(across);
        const farLeft = end.clone().sub(across),
          farRight = end.clone().add(across);
        for (const vertex of [left, farLeft, right, right, farLeft, farRight]) {
          vertices.push(vertex.x, vertex.y, vertex.z);
        }
      }
    }
    if (!vertices.length) {
      replaceGeometry(this.paths, null);
      return;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.computeVertexNormals();
    replaceGeometry(this.paths, geometry);
  }
}
