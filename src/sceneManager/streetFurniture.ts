import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ModelKey } from '../assetManager/constants';
import { BUILDING_TYPE, type BuildingType } from '../city/building/constants';
import { coloredShape } from './coast';

import type { BenchStop } from './pedestrians';

const IRON = 0x31483f;
const BRASS = 0xc39752;
const block = new THREE.BoxGeometry(1, 1, 1);

function lampGeometry(): THREE.BufferGeometry {
  const ring = (
    bottom: number,
    top: number,
    y: number,
    height: number,
    color: number
  ) =>
    coloredShape(
      new THREE.CylinderGeometry(top, bottom, height, 8),
      color,
      0,
      y + height / 2,
      0
    );
  const housing = mergeGeometries([
    ring(0.022, 0.02, 0, 0.024, IRON),
    ring(0.015, 0.008, 0.024, 0.19, IRON),
    ring(0.015, 0.015, 0.207, 0.012, BRASS),
    ring(0.014, 0.033, 0.219, 0.018, IRON),
    ring(0.045, 0.012, 0.285, 0.027, IRON),
    ring(0.009, 0.003, 0.312, 0.014, BRASS),
  ]);
  const glass = ring(0.029, 0.039, 0.237, 0.048, 0xffe29c);
  // A separate unlit material keeps the panes warm even on the shaded side.
  return mergeGeometries([housing, glass], true);
}

function benchGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-0.063, 0.063]) {
    parts.push(coloredShape(block, IRON, x, 0.021, 0, 0.013, 0.042, 0.065));
    parts.push(coloredShape(block, IRON, x, 0.054, -0.031, 0.012, 0.09, 0.012));
  }
  for (const z of [-0.02, 0, 0.02]) {
    parts.push(coloredShape(block, 0xbc804e, 0, 0.045, z, 0.182, 0.012, 0.016));
  }
  for (const y of [0.073, 0.095]) {
    parts.push(
      coloredShape(block, 0xa56a40, 0, y, -0.025, 0.182, 0.017, 0.013)
    );
  }
  return mergeGeometries(parts);
}

function signGeometry(): THREE.BufferGeometry {
  const parts = [
    coloredShape(block, IRON, -0.047, 0.065, 0, 0.012, 0.13, 0.012),
    coloredShape(block, IRON, 0.047, 0.065, 0, 0.012, 0.13, 0.012),
    coloredShape(block, IRON, 0, 0.15, 0, 0.167, 0.11, 0.018),
  ];
  const factory = new THREE.Shape();
  factory.moveTo(-0.05, 0);
  factory.lineTo(-0.05, 0.025);
  factory.lineTo(-0.022, 0.04);
  factory.lineTo(-0.022, 0.025);
  factory.lineTo(0.006, 0.04);
  factory.lineTo(0.006, 0.025);
  factory.lineTo(0.021, 0.025);
  factory.lineTo(0.024, 0.061);
  factory.lineTo(0.039, 0.061);
  factory.lineTo(0.042, 0);
  factory.closePath();
  const icon = new THREE.ShapeGeometry(factory);
  for (const side of [-1, 1]) {
    parts.push(
      coloredShape(block, 0xf3bc54, 0, 0.15, side * 0.009, 0.151, 0.096, 0.004)
    );
    parts.push(
      coloredShape(
        icon,
        IRON,
        0,
        0.12,
        side * 0.012,
        1,
        1,
        1,
        side === 1 ? 0 : Math.PI
      )
    );
  }
  return mergeGeometries(parts);
}

// Centers of the sidewalk bands in the unrotated road GLBs, in tile units.
const LAMP_SITES: Partial<
  Record<ModelKey, readonly (readonly [number, number])[]>
> = {
  [ModelKey.ROAD_CORNER]: [[0.24, 0.24]],
  [ModelKey.ROAD_TEE]: [
    [0.145, 0.145],
    [-0.145, 0.145],
  ],
  [ModelKey.ROAD_INTERSECTION]: [
    [0.145, 0.145],
    [-0.145, -0.145],
  ],
};

export class StreetFurniture extends THREE.Group {
  private lamps: THREE.InstancedMesh;
  private benches: THREE.InstancedMesh;
  private signs: THREE.InstancedMesh;
  private transform = new THREE.Matrix4();

  constructor(size: number) {
    super();
    const finish = new THREE.MeshLambertMaterial({ vertexColors: true });
    const glass = new THREE.MeshBasicMaterial({ vertexColors: true });
    const tiles = size * size;
    this.lamps = new THREE.InstancedMesh(
      lampGeometry(),
      [finish, glass],
      tiles * 2
    );
    this.benches = new THREE.InstancedMesh(benchGeometry(), finish, tiles);
    this.signs = new THREE.InstancedMesh(signGeometry(), finish, tiles);
    for (const batch of [this.lamps, this.benches, this.signs]) {
      batch.count = 0;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.castShadow = batch.receiveShadow = true;
      batch.userData.nonInteractive = true;
      batch.raycast = () => {};
      this.add(batch);
    }
  }

  clearInstances(): void {
    this.lamps.count = this.benches.count = this.signs.count = 0;
  }

  finishUpdate(): void {
    for (const batch of [this.lamps, this.benches, this.signs]) {
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
    }
  }

  addCorner(model: ModelKey, road: THREE.Matrix4): void {
    const sites = LAMP_SITES[model];
    if (!sites) return;
    for (const [x, z] of sites) {
      this.transform.makeTranslation(x, 0, z).premultiply(road);
      this.lamps.setMatrixAt(this.lamps.count++, this.transform);
    }
  }

  addFrontage(
    type: BuildingType,
    model: ModelKey,
    lot: THREE.Matrix4,
    start: THREE.Vector3,
    end: THREE.Vector3,
    halfWidth: number,
    paving: number[]
  ): BenchStop | undefined {
    if (
      model === ModelKey.UNDER_CONSTRUCTION ||
      (type !== BUILDING_TYPE.INDUSTRIAL && type !== BUILDING_TYPE.COMMERCIAL)
    )
      return;

    const inverse = lot.clone().invert();
    const door = start.clone().applyMatrix4(inverse);
    const curb = end.clone().applyMatrix4(inverse);
    // Sample the real path close to the lot boundary. Its angle can differ
    // from the facade's at a curved curb or cul-de-sac.
    const slope = (curb.x - door.x) / (curb.z - door.z);
    const z = 0.475;
    const pathX = door.x + (z - door.z) * slope;
    const side = pathX > 0 ? -1 : 1;
    const edge = pathX + side * halfWidth * Math.hypot(1, slope);
    const x = edge + side * (0.115 + 0.045 * Math.abs(slope));
    const bench = type === BUILDING_TYPE.COMMERCIAL;
    this.transform.makeTranslation(x, bench ? start.y : 0, z).premultiply(lot);
    const batch = bench ? this.benches : this.signs;
    batch.setMatrixAt(batch.count++, this.transform);

    if (bench) {
      // Extend the pavement beside the walkway, right up to both bench feet.
      const depth = 0.046;
      const outer = x + side * 0.104;
      const inner = (dz: number) => edge + slope * dz - side * 0.002;
      const corners = [
        new THREE.Vector3(inner(-depth), start.y, z - depth),
        new THREE.Vector3(inner(depth), start.y, z + depth),
        new THREE.Vector3(outer, start.y, z - depth),
        new THREE.Vector3(outer, start.y, z + depth),
      ].map((point) => point.applyMatrix4(lot));
      const indices = side > 0 ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 2, 3, 1];
      for (const index of indices) {
        const point = corners[index];
        paving.push(point.x, point.y, point.z);
      }
      return {
        approach: new THREE.Vector3(pathX, start.y, z).applyMatrix4(lot),
        seat: new THREE.Vector3(x, start.y + 0.002, z + 0.003).applyMatrix4(
          lot
        ),
        yaw: Math.atan2(lot.elements[8], lot.elements[10]),
      };
    }
  }
}
