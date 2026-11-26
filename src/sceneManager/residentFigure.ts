import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { METERS_PER_TILE } from '../assetManager/worldScale';
import { coloredShape } from './coast';
import { residentSpread } from './householdLights';

const cloth = new THREE.MeshLambertMaterial({ vertexColors: true });
const sphere = new THREE.SphereGeometry(1, 12, 9);
const hairCap = new THREE.SphereGeometry(
  1,
  12,
  8,
  0,
  Math.PI * 2,
  0,
  Math.PI * 0.57
);
const box = new THREE.BoxGeometry();
const hipHeight = 0.91;

// Rings in metres give coats a waist, shoulders a slope and limbs a taper.
// The same joint locations serve every outfit, including the courier's.
function profile(
  rings: [number, number][],
  depth: number
): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    rings.map(([y, radius]) => new THREE.Vector2(radius, y)),
    12
  ).scale(1, 1, depth);
}
const shirtShape = profile(
  [
    [0.82, 0.15],
    [0.88, 0.172],
    [1.06, 0.138],
    [1.25, 0.17],
    [1.36, 0.188],
    [1.405, 0.177],
    [1.455, 0.067],
  ],
  0.7
);
const sleeve = profile(
  [
    [-0.275, 0.038],
    [-0.22, 0.044],
    [-0.085, 0.058],
    [-0.03, 0.06],
    [0.02, 0.04],
  ],
  0.91
);
const cuff = profile(
  [
    [-0.225, 0.029],
    [-0.17, 0.036],
    [-0.07, 0.043],
    [0.015, 0.039],
  ],
  0.9
);
const thigh = profile(
  [
    [-0.427, 0.052],
    [-0.34, 0.065],
    [-0.15, 0.085],
    [-0.015, 0.092],
    [0.035, 0.064],
  ],
  0.92
);
const calf = profile(
  [
    [-0.37, 0.042],
    [-0.32, 0.044],
    [-0.14, 0.066],
    [-0.05, 0.059],
    [0.012, 0.051],
  ],
  0.9
);
const outfits = [
  [0xb56145, 0x344456, 0xe3b394, 0x51372f],
  [0xca984d, 0x3c5051, 0x915e46, 0x302a26],
  [0x50859b, 0x414454, 0xcd9978, 0x503b30],
  [0x75854f, 0x41475a, 0xd0a184, 0x73716b],
  [0x945f79, 0x414d5e, 0x98654c, 0x312a28],
  [0x45776c, 0x585463, 0xdfb89a, 0x835839],
  [0xe1a32f, 0x304553, 0xb67d5b, 0x413831], // Delivery uniform
];
const courier = outfits.length - 1;
const wardrobes = outfits.map(([shirt, denim, skin, hair], i) => {
  const head = [
    coloredShape(sphere, skin, 0, 1.47, 0, 0.058, 0.082, 0.056),
    coloredShape(sphere, skin, 0, 1.61, 0.009, 0.09, 0.124, 0.089),
    coloredShape(sphere, skin, 0, 1.603, 0.092, 0.019, 0.025, 0.021),
    coloredShape(hairCap, hair, 0, 1.651, -0.003, 0.094, 0.103, 0.093),
  ];
  if (i === 1 || i === 4)
    head.push(coloredShape(sphere, hair, 0, 1.61, -0.085, 0.058, 0.056, 0.044));
  if (i === courier)
    head.push(
      coloredShape(hairCap, denim, 0, 1.675, 0, 0.1, 0.085, 0.102),
      coloredShape(sphere, denim, 0, 1.676, 0.081, 0.089, 0.011, 0.068)
    );
  const jacket = [coloredShape(shirtShape, shirt, 0, 0, 0)];
  if (i === courier) {
    for (const y of [1.06, 1.19])
      jacket.push(coloredShape(sphere, 0xf9e2ab, 0, y, 0, 0.162, 0.024, 0.117));
  } else if (i % 2 === 0) {
    jacket.push(
      coloredShape(box, 0x534c46, 0, 1.14, 0.109, 0.011, 0.43, 0.009)
    );
  }
  jacket.push(coloredShape(sphere, denim, 0, 0.888, 0, 0.162, 0.1, 0.107));
  return {
    body: mergeGeometries([...jacket, ...head]),
    arm: coloredShape(sleeve, shirt, 0, 0, 0),
    forearm: mergeGeometries([
      coloredShape(cuff, i % 2 ? shirt : skin, 0, 0, 0),
      coloredShape(sphere, skin, 0, -0.255, 0.004, 0.031, 0.054, 0.023),
    ]),
    leg: coloredShape(thigh, denim, 0, 0, 0),
    shin: mergeGeometries([
      coloredShape(calf, denim, 0, 0, 0),
      coloredShape(sphere, 0x352f2c, 0, -0.42, 0.035, 0.057, 0.063, 0.116),
      coloredShape(sphere, 0x52473e, 0, -0.466, 0.043, 0.056, 0.017, 0.117),
    ]),
  };
});

export class ResidentFigure extends THREE.Group {
  protected skeleton = new THREE.Group();
  protected torso = new THREE.Mesh(wardrobes[0].body, cloth);
  protected arms = [-1, 1].map(() => new THREE.Mesh(wardrobes[0].arm, cloth));
  protected forearms = [-1, 1].map(
    () => new THREE.Mesh(wardrobes[0].forearm, cloth)
  );
  readonly legs = [-1, 1].map(() => new THREE.Mesh(wardrobes[0].leg, cloth));
  private shins = [-1, 1].map(() => new THREE.Mesh(wardrobes[0].shin, cloth));

  constructor(uniform = false) {
    super();
    this.add(this.skeleton);
    this.skeleton.add(this.torso, ...this.arms, ...this.legs);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      this.arms[i].position.set(side * 0.182, 1.365, 0);
      this.arms[i].rotation.z = side * 0.065;
      this.forearms[i].position.y = -0.265;
      this.arms[i].add(this.forearms[i]);
      this.legs[i].position.set(side * 0.078, hipHeight, 0);
      this.shins[i].position.y = -0.427;
      this.legs[i].add(this.shins[i]);
    }
    this.wear(uniform ? courier : 0, 1);
    this.traverse((part) => {
      part.castShadow = true;
      part.userData.nonInteractive = true;
      part.raycast = () => {};
    });
  }

  private wear(index: number, stature: number): void {
    const kit = wardrobes[index];
    this.scale.setScalar(stature / METERS_PER_TILE);
    this.torso.geometry = kit.body;
    for (let i = 0; i < 2; i++) {
      this.arms[i].geometry = kit.arm;
      this.forearms[i].geometry = kit.forearm;
      this.legs[i].geometry = kit.leg;
      this.shins[i].geometry = kit.shin;
    }
  }

  dress(id: string): void {
    const variation = residentSpread(id);
    this.wear(
      Math.floor(variation * courier),
      0.94 + 0.12 * ((variation * 13) % 1)
    );
  }

  protected gait(phase: number, moving: boolean, carrying = false): void {
    this.skeleton.position.y = moving ? 0.015 * Math.abs(Math.sin(phase)) : 0;
    this.torso.rotation.x = moving ? 0.022 : 0;
    for (let i = 0; i < 2; i++) {
      const step = moving ? Math.sin(phase + i * Math.PI) : 0;
      this.legs[i].rotation.x = -0.48 * step;
      this.shins[i].rotation.x = moving
        ? 0.1 + 0.64 * Math.max(0, Math.cos(phase + i * Math.PI))
        : 0;
      this.arms[i].rotation.x = carrying ? -0.3 : 0.36 * step;
      this.forearms[i].rotation.x = carrying
        ? -1.06
        : -0.19 - 0.12 * Math.max(0, -step);
    }
  }

  protected sit(): void {
    this.gait(0, false);
    this.skeleton.position.y =
      0.49 / (this.scale.y * METERS_PER_TILE) - hipHeight;
    for (let i = 0; i < 2; i++) {
      this.legs[i].rotation.x = -1.53;
      this.shins[i].rotation.x = 1.55;
      this.arms[i].rotation.x = -0.35;
      this.forearms[i].rotation.x = -0.68;
    }
  }
}
