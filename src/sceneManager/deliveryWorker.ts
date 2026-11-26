import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coloredShape } from './coast';

import { ResidentFigure } from './residentFigure';

export const DELIVERY_GAIT = 86;

const block = new THREE.BoxGeometry();
const parcel = mergeGeometries([
  coloredShape(block, 0xc38b53, 0, 0, 0, 0.4, 0.28, 0.26),
  coloredShape(block, 0xf1d28d, 0, 0.001, 0, 0.053, 0.281, 0.261),
]);
const cardboard = new THREE.MeshLambertMaterial({ vertexColors: true });

export class DeliveryWorker extends ResidentFigure {
  private box = new THREE.Mesh(parcel, cardboard);
  constructor() {
    super(true);
    this.box.position.set(0, 1.04, 0.255);
    this.box.userData.nonInteractive = true;
    this.box.raycast = () => {};
    this.skeleton.add(this.box);
    this.visible = false;
  }

  walk(
    from: THREE.Vector3,
    curb: THREE.Vector3,
    door: THREE.Vector3,
    distance: number,
    carrying: boolean
  ): void {
    this.visible = true;
    this.box.visible = carrying;
    const first = from.distanceTo(curb);
    const [a, b, length, traveled] =
      distance <= first
        ? ([from, curb, first, distance] as const)
        : ([curb, door, curb.distanceTo(door), distance - first] as const);
    this.position.lerpVectors(
      a,
      b,
      THREE.MathUtils.clamp(traveled / Math.max(length, 0.0001), 0, 1)
    );
    this.rotation.y =
      Math.atan2(b.x - a.x, b.z - a.z) + (carrying ? 0 : Math.PI);
    const moving =
      distance > 0.0001 && distance < first + curb.distanceTo(door) - 0.0001;
    this.gait(distance * DELIVERY_GAIT, moving, carrying);
  }
}
