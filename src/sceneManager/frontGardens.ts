import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coloredShape } from './coast';

const box = new THREE.BoxGeometry();
const crown = new THREE.IcosahedronGeometry(1, 0);
const bedWidth = 0.36;
const fenceZ = 0.433;
const plantingZ = 0.368;

function gardenBed(style: number): THREE.BufferGeometry {
  const edge = style === 1 ? 0xa47758 : 0xd5c7a3;
  const parts = [
    coloredShape(box, 0x95ad70, 0, 0.005, 0.335, bedWidth, 0.008, 0.22),
    coloredShape(box, 0x867354, 0, 0.017, plantingZ, bedWidth, 0.024, 0.1),
    coloredShape(box, edge, 0, 0.031, fenceZ, bedWidth, 0.048, 0.022),
  ];
  if (style === 1) {
    // Open timber rails between the taller piers.
    parts.push(
      coloredShape(box, 0xad835b, 0, 0.083, fenceZ, bedWidth, 0.016, 0.018)
    );
  } else {
    parts.push(
      coloredShape(box, 0xedddba, 0, 0.061, fenceZ, bedWidth, 0.015, 0.032)
    );
  }
  for (const x of [-0.166, 0, 0.166]) {
    parts.push(coloredShape(box, edge, x, 0.054, fenceZ, 0.026, 0.1, 0.029));
  }
  if (style === 0) {
    // A pair of terracotta pots leaves more of the lawn visible than a hedge.
    const pot = new THREE.CylinderGeometry(0.044, 0.032, 0.062, 8);
    for (const x of [-0.09, 0.09]) {
      parts.push(coloredShape(pot, 0xb96e50, x, 0.059, plantingZ));
      parts.push(
        coloredShape(crown, 0x668752, x, 0.107, plantingZ, 0.053, 0.042, 0.048)
      );
      parts.push(
        coloredShape(crown, 0xf0c570, x, 0.142, plantingZ, 0.027, 0.019, 0.029)
      );
    }
    return mergeGeometries(parts);
  }
  const leaves = [0x568150, 0x799055, 0x446f59];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.068;
    parts.push(
      coloredShape(
        crown,
        leaves[style],
        x,
        0.065,
        plantingZ,
        0.05,
        style === 2 ? 0.064 : 0.042,
        0.046,
        i
      )
    );
    if (style !== 2) {
      parts.push(
        coloredShape(
          crown,
          0xcd8771,
          x + 0.012,
          0.102,
          plantingZ + 0.011,
          0.02,
          0.013,
          0.02
        )
      );
    }
  }
  return mergeGeometries(parts);
}

function streetTree(): THREE.BufferGeometry {
  return mergeGeometries([
    coloredShape(box, 0xb6a487, 0, 0.016, 0, 0.14, 0.018, 0.14),
    coloredShape(box, 0x73624a, 0, 0.027, 0, 0.111, 0.009, 0.111),
    coloredShape(
      new THREE.CylinderGeometry(0.012, 0.021, 0.23, 7),
      0x86684b,
      0,
      0.14,
      0
    ),
    coloredShape(crown, 0x688d50, 0, 0.28, 0, 0.115, 0.144, 0.106),
    coloredShape(
      crown,
      0x88a35d,
      -0.055,
      0.324,
      0.021,
      0.079,
      0.096,
      0.084,
      1.6
    ),
  ]);
}

export class FrontGardens extends THREE.Group {
  private beds: THREE.InstancedMesh[];
  private trees: THREE.InstancedMesh;
  private placement = new THREE.Matrix4();

  constructor(size: number) {
    super();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const batch = (shape: THREE.BufferGeometry, capacity: number) => {
      const mesh = new THREE.InstancedMesh(shape, material, capacity);
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.nonInteractive = true;
      mesh.raycast = () => {};
      this.add(mesh);
      return mesh;
    };
    this.beds = [0, 1, 2].map((style) =>
      batch(gardenBed(style), size * size * 2)
    );
    this.trees = batch(streetTree(), size * size);
  }

  clearInstances(): void {
    for (const bed of this.beds) bed.count = 0;
    this.trees.count = 0;
  }

  addHome(
    lot: THREE.Matrix4,
    door: THREE.Vector3,
    curb: THREE.Vector3,
    halfWidth: number
  ): void {
    const inverse = lot.clone().invert();
    const a = door.clone().applyMatrix4(inverse),
      b = curb.clone().applyMatrix4(inverse);
    if (b.z <= a.z) return;
    const slope = (b.x - a.x) / (b.z - a.z);
    const pathAt = (z: number) => a.x + (z - a.z) * slope;
    // Keep the whole oblique path open, including the back of the planting bed.
    const clearance = halfWidth * Math.hypot(1, slope) + 0.024;
    const paths = [pathAt(0.225), pathAt(0.46)];
    const left = Math.min(...paths) - clearance,
      right = Math.max(...paths) + clearance;
    const x = Math.round(lot.elements[12]),
      z = Math.round(lot.elements[14]);
    const style = (x + 2 * z) % this.beds.length;
    const bed = this.beds[style];
    for (const [lo, hi] of [
      [-0.45, Math.min(left, 0.45)],
      [Math.max(right, -0.45), 0.45],
    ]) {
      if (hi - lo < 0.06) continue;
      this.placement
        .makeScale((hi - lo) / bedWidth, 1, 1)
        .setPosition((lo + hi) / 2, 0, 0)
        .premultiply(lot);
      bed.setMatrixAt(bed.count++, this.placement);
    }
    // Keep a regular street-tree rhythm, switching sides at wide, offset entrances.
    const treeX = pathAt(0.55) > 0.12 ? -0.345 : 0.345;
    this.placement
      .makeRotationY(style * 2)
      .setPosition(treeX, 0, 0.55)
      .premultiply(lot);
    this.trees.setMatrixAt(this.trees.count++, this.placement);
  }

  finishUpdate(): void {
    for (const batch of [...this.beds, this.trees]) {
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
    }
  }
}
