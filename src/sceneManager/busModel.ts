import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { METERS_PER_TILE } from '../assetManager/worldScale';
import { coloredShape } from './coast';

const box = new THREE.BoxGeometry();
const wheel = new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2);
const navy = 0x203f49,
  teal = 0x218583,
  cream = 0xffe8bc,
  glass = 0x63838a;
const part = (
  color: number,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number
) => coloredShape(box, color, x, y, z, w, h, d);

// An eight-metre neighborhood bus. Local +X is forward and +Z faces the curb.
function body() {
  const parts = [
    part(teal, 0, 1.08, 0, 8, 1.05, 2.38),
    part(navy, 0, 2.08, 0, 7.92, 1.06, 2.35),
    part(cream, 0, 2.72, 0, 8.02, 0.24, 2.42),
    part(cream, -0.7, 2.94, 0, 2.1, 0.2, 1.38),
    part(glass, 3.975, 2.07, 0, 0.06, 0.87, 2.04),
    part(navy, 4.01, 2.54, 0, 0.05, 0.25, 1.82),
    part(0xffc552, 4.045, 2.54, 0.52, 0.03, 0.18, 0.06),
    part(0xffc552, 4.045, 2.46, 0.52, 0.03, 0.035, 0.14),
    part(glass, -3.98, 2.05, 0, 0.05, 0.72, 1.83),
  ];
  for (const side of [-1, 1]) {
    parts.push(part(cream, 0, 1.46, side * 1.19, 7.98, 0.11, 0.05));
    for (const x of [-3.23, -2.01, -0.79, 0.43, 1.65, 2.87]) {
      if (side === 1 && x === 2.87) continue;
      parts.push(part(glass, x, 2.07, side * 1.185, 1.09, 0.88, 0.06));
    }
    parts.push(
      part(0xffe7a2, 4.015, 1.05, side * 0.91, 0.04, 0.17, 0.35),
      part(0xb64439, -4.015, 1.09, side, 0.04, 0.25, 0.16)
    );
    for (const x of [-2.5, 2.25]) {
      parts.push(
        coloredShape(wheel, 0x292e32, x, 0.48, side * 1.13, 0.48, 0.48, 0.29)
      );
      parts.push(
        coloredShape(wheel, 0xc8c6ac, x, 0.48, side * 1.279, 0.24, 0.24, 0.04)
      );
    }
  }
  parts.push(part(navy, 2.95, 1.5, 1.202, 1.14, 2.11, 0.035));
  return mergeGeometries(parts);
}

const hull = body();
const doorLeaf = mergeGeometries([
  part(cream, 0, 0, 0, 0.54, 1.99, 0.055),
  part(glass, 0, 0.41, 0.032, 0.42, 0.89, 0.025),
  part(teal, 0, -0.52, 0.032, 0.42, 0.68, 0.025),
]);
// Tinted silhouettes in the side windows track the people actually on board.
const oval = new THREE.SphereGeometry(1, 10, 8);
const seated = mergeGeometries(
  [-1, 1].map((side) =>
    mergeGeometries([
      coloredShape(oval, 0x917f69, 0, 2.04, side * 1.22, 0.115, 0.15, 0.018),
      coloredShape(oval, 0x546b6b, -0.035, 1.8, side * 1.22, 0.23, 0.16, 0.016),
    ])
  )
);
const marker = mergeGeometries([
  part(navy, 0, 1.2, 0, 0.08, 2.4, 0.08),
  part(teal, 0, 2.52, 0, 0.62, 0.65, 0.095),
  ...[-1, 1].map((s) => part(cream, 0, 2.53, s * 0.055, 0.065, 0.36, 0.025)),
  part(cream, 0, 1.65, 0, 0.35, 0.52, 0.085),
  part(teal, 0, 1.72, 0.05, 0.22, 0.045, 0.016),
]);
const paint = new THREE.MeshLambertMaterial({ vertexColors: true });
function mesh(geometry: THREE.BufferGeometry, material = paint) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = m.receiveShadow = m.userData.nonInteractive = true;
  m.raycast = () => {};
  return m;
}
export function busStopMarker() {
  const pole = mesh(marker);
  pole.scale.setScalar(1 / METERS_PER_TILE);
  return pole;
}

export class BusModel extends THREE.Mesh {
  private seats = [-3.23, -2.01, -0.79, 0.43, 1.65].map((x) => {
    const seat = mesh(seated);
    seat.position.x = x;
    seat.visible = false;
    return seat;
  });
  private leaves = [-1, 1].map(() => mesh(doorLeaf));
  constructor() {
    // Vehicle disposes the materials of its model on removal.
    const material = paint.clone();
    super(hull, material);
    this.castShadow = this.receiveShadow = this.userData.nonInteractive = true;
    this.raycast = () => {};
    this.scale.setScalar(1 / METERS_PER_TILE);
    this.add(...this.leaves, ...this.seats);
    for (const part of [...this.leaves, ...this.seats])
      part.material = material;
    this.openDoors(1);
  }
  showPassengers(count: number) {
    this.seats.forEach((seat, i) => {
      seat.visible = i < count;
    });
  }
  openDoors(fraction: number) {
    this.leaves.forEach((leaf, i) =>
      leaf.position.set(
        2.95 + (i ? 1 : -1) * (0.28 + 0.5 * fraction),
        1.5,
        1.24
      )
    );
  }
}
