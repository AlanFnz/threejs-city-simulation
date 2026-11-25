import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ICity } from '../city';
import { coloredShape } from './coast';

interface Grove {
  x: number;
  y: number;
  matrix: THREE.Matrix4;
  cleared: boolean;
}

/** Cosmetic trees share a single draw call and give way to any building,
 * including undeveloped zones that still display the grass underneath. */
export class Woodland extends THREE.InstancedMesh {
  private groves: Grove[];
  private clearedMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(size: number) {
    const groves: Grove[] = [];
    const tree = new THREE.Object3D();
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const patch =
          Math.cos(x * 0.74 + y * 0.29 + Math.sin(y * 0.27)) +
          Math.sin(y * 0.95 - x * 0.21 + Math.cos(x * 0.32));
        const noise = Math.sin(x * 73.3 + y * 97.1);
        if (patch + noise * 0.72 < 1.35) continue;
        tree.position.set(x + 0.085 * noise, -0.01, y);
        tree.rotation.y = x * 2.3 + y * 3.2;
        tree.scale.setScalar(0.78 + 0.19 * noise);
        tree.updateMatrix();
        groves.push({ x, y, matrix: tree.matrix.clone(), cleared: false });
      }
    }

    const canopy = new THREE.IcosahedronGeometry(1, 0);
    const geometry = mergeGeometries([
      coloredShape(
        new THREE.CylinderGeometry(0.045, 0.07, 0.55, 6),
        0x886746,
        0,
        0.26,
        0
      ),
      coloredShape(canopy, 0x538445, 0.01, 0.66, 0, 0.32, 0.42, 0.34),
      coloredShape(canopy, 0x82a650, -0.17, 0.57, 0.04, 0.26, 0.25, 0.23, 1.6),
      coloredShape(canopy, 0x719a4b, 0.25, 0.12, -0.2, 0.17, 0.16, 0.19),
    ]);
    super(
      geometry,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      groves.length
    );
    this.groves = groves;
    groves.forEach((grove, slot) => this.setMatrixAt(slot, grove.matrix));
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.castShadow = true;
    this.receiveShadow = true;
    this.userData.nonInteractive = true;
    this.raycast = () => {};
    // Keep the full woodland bounds even if the player later clears every tree.
    this.computeBoundingSphere();
  }

  update(city: ICity): void {
    this.groves.forEach((grove, slot) => {
      const cleared = !!city.getTile(grove.x, grove.y)?.building;
      if (grove.cleared === cleared) return;
      grove.cleared = cleared;
      this.setMatrixAt(slot, cleared ? this.clearedMatrix : grove.matrix);
      this.instanceMatrix.needsUpdate = true;
    });
  }
}
