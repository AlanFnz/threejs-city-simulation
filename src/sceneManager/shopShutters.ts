import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coloredShape } from './coast';
import { shopfrontFits, type ShopFront } from './promenade';

const box = new THREE.BoxGeometry();
const blades = 9;
const metal = new THREE.MeshLambertMaterial({ vertexColors: true });
const slat = mergeGeometries([
  coloredShape(box, 0x708782, 0, 0.5, 0, 1, 1, 0.009),
  coloredShape(box, 0xa4b2a5, 0, 0.85, 0.005, 1, 0.17, 0.004),
]);
const frame = mergeGeometries([
  ...[-0.51, 0.51].map((x) =>
    coloredShape(box, 0x445954, x, 0.5, 0, 0.035, 1, 0.014)
  ),
  coloredShape(box, 0x485f58, 0, 1, 0.011, 1.09, 0.13, 0.034),
]);

export function shutterOpening(x: number, z: number, minute: number): number {
  const offset = (x * 37 + z * 17) % 55;
  const opens = 7.5 * 60 + offset;
  const closes = 19.5 * 60 + offset;
  return (
    THREE.MathUtils.smoothstep(minute, opens, opens + 28) *
    (1 - THREE.MathUtils.smoothstep(minute, closes, closes + 28))
  );
}

export class ShopShutters extends THREE.Group {
  private slats: THREE.InstancedMesh;
  private frames: THREE.InstancedMesh;
  private shops: {
    x: number;
    z: number;
    mount: THREE.Matrix4;
    last: number;
  }[] = [];
  private local = new THREE.Matrix4();

  constructor(size: number) {
    super();
    this.slats = new THREE.InstancedMesh(slat, metal, size * size * blades);
    this.frames = new THREE.InstancedMesh(frame, metal, size * size);
    for (const batch of [this.slats, this.frames]) {
      batch.count = 0;
      batch.castShadow = batch.receiveShadow = true;
      batch.userData.nonInteractive = true;
      batch.raycast = () => {};
      this.add(batch);
    }
    this.slats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  rebuild(stores: ShopFront[]): void {
    this.shops = stores.map((shop) => {
      const [x, z, top, width] = shopfrontFits[shop.modelKey] ?? [
        0, 0.233, 0.13, 0.22,
      ]; // Built-in counter canopy of the burger stand.
      const mount = new THREE.Matrix4()
        .makeScale(width, top - 0.026, 1)
        .setPosition(x, 0.015, z + 0.012)
        .premultiply(shop.matrix);
      return { x: shop.x, z: shop.z, mount, last: -1 };
    });
    this.frames.count = stores.length;
    this.slats.count = stores.length * blades;
    for (const [i, shop] of this.shops.entries())
      this.frames.setMatrixAt(i, shop.mount);
    this.frames.instanceMatrix.needsUpdate = true;
    this.frames.computeBoundingSphere();
    // A closed frame encloses its curtain at every position.
    this.slats.boundingSphere = this.frames.boundingSphere!.clone();
  }

  update(
    minute: number,
    receiving?: { x: number; z: number; opening: number }
  ): void {
    for (const [i, shop] of this.shops.entries()) {
      const delivery =
        receiving?.x === shop.x && receiving.z === shop.z
          ? receiving.opening
          : 0;
      const open = Math.max(delivery, shutterOpening(shop.x, shop.z, minute));
      if (open === shop.last) continue;
      shop.last = open;
      for (let row = 0; row < blades; row++) {
        const bottom = Math.min(1, row / blades + open);
        const height = Math.min(1 / blades, 1 - bottom);
        this.local
          .makeScale(1, Math.max(0.0001, height), 1)
          .setPosition(0, bottom, 0)
          .premultiply(shop.mount);
        this.slats.setMatrixAt(i * blades + row, this.local);
      }
      this.slats.instanceMatrix.needsUpdate = true;
    }
  }
}
