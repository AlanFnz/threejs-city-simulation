import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coloredShape } from '../sceneManager/coast';

const unit = new THREE.BoxGeometry();
const soil = 0xad865e,
  concrete = 0xc8bdab,
  steel = 0x485b61;
const timber = 0xb77743,
  safety = 0xf2b544,
  iron = 0x616563;

export function createConstructionSite(
  frame: boolean,
  count: number
): THREE.InstancedMesh {
  const parts: THREE.BufferGeometry[] = [];
  const box = (
    color: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number
  ) => parts.push(coloredShape(unit, color, x, y, z, w, h, d));
  const beam = (
    color: number,
    a: THREE.Vector3,
    b: THREE.Vector3,
    width: number
  ) => {
    const delta = b.clone().sub(a);
    const piece = coloredShape(
      unit,
      color,
      0,
      0,
      0,
      width,
      delta.length(),
      width
    );
    piece.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize()
      )
    );
    const mid = a.clone().lerp(b, 0.5);
    parts.push(piece.translate(mid.x, mid.y, mid.z));
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  box(soil, 0, 0.011, 0, 0.83, 0.018, 0.81);
  // Open the front fence at the access path and lay down two timber wheel tracks.
  for (const x of [-0.095, 0.095])
    box(timber, x, 0.024, 0.31, 0.042, 0.012, 0.18);
  for (const x of [-0.31, 0.31]) {
    box(0xe3d5b9, x, 0.087, 0.38, 0.2, 0.042, 0.014);
    for (const offset of [-0.071, 0, 0.071]) {
      box(0xd47043, x + offset, 0.087, 0.39, 0.031, 0.042, 0.009);
    }
    for (const offset of [-0.071, 0.071])
      box(steel, x + offset, 0.049, 0.38, 0.015, 0.086, 0.02);
  }
  // Strip footings and exposed starter bars mark the future column grid.
  for (const x of [-0.25, 0, 0.25]) {
    box(concrete, x, 0.032, -0.025, 0.044, 0.029, 0.49);
    for (const z of [-0.25, 0.2]) box(iron, x, 0.077, z, 0.012, 0.073, 0.012);
  }
  for (const z of [-0.25, 0.2]) box(concrete, 0, 0.034, z, 0.54, 0.03, 0.045);
  for (let i = 0; i < 4; i++)
    box(0xb95e44, -0.33, 0.033 + i * 0.019, -0.13, 0.096, 0.017, 0.17);

  if (frame) {
    for (const x of [-0.25, 0, 0.25]) {
      for (const z of [-0.25, 0.2]) box(steel, x, 0.32, z, 0.032, 0.58, 0.034);
    }
    for (const y of [0.29, 0.55]) {
      for (const z of [-0.25, 0.2]) box(steel, 0, y, z, 0.54, 0.035, 0.035);
      for (const x of [-0.25, 0, 0.25])
        box(steel, x, y, -0.025, 0.033, 0.035, 0.48);
      box(concrete, -0.12, y + 0.024, -0.025, 0.26, 0.024, 0.48);
    }
    // A braced side bay, partial blockwork and an open front reveal the floors.
    beam(steel, v(-0.25, 0.055, 0.2), v(-0.25, 0.27, -0.25), 0.021);
    box(0xad694d, -0.115, 0.11, -0.24, 0.22, 0.14, 0.035);

    // Compact tower crane with a trussed jib, counterweight and suspended hook.
    const mast = 0.347,
      back = -0.28,
      top = 0.76;
    box(concrete, mast, 0.042, back, 0.103, 0.055, 0.105);
    for (const x of [mast - 0.024, mast + 0.024])
      for (const z of [back - 0.024, back + 0.024])
        box(safety, x, top / 2, z, 0.012, top, 0.012);
    for (let i = 0; i < 6; i++) {
      beam(
        safety,
        v(mast - 0.024, 0.055 + i * 0.111, back + 0.024),
        v(mast + 0.024, 0.166 + i * 0.111, back + 0.024),
        0.012
      );
    }
    box(safety, 0.082, top, back, 0.68, 0.023, 0.048);
    box(safety, 0.082, top + 0.046, back, 0.66, 0.012, 0.015);
    for (let i = 0; i < 8; i++) {
      const x = -0.245 + i * 0.082;
      beam(safety, v(x, top, back), v(x + 0.041, top + 0.046, back), 0.009);
      beam(
        safety,
        v(x + 0.041, top + 0.046, back),
        v(x + 0.082, top, back),
        0.009
      );
    }
    box(steel, 0.393, top - 0.02, back, 0.065, 0.075, 0.083);
    box(0xead8ae, mast - 0.031, top - 0.045, back + 0.03, 0.073, 0.062, 0.058);
    box(iron, -0.184, top - 0.082, back, 0.008, 0.164, 0.008);
    box(safety, -0.184, top - 0.17, back, 0.025, 0.021, 0.025);
  }
  const mesh = new THREE.InstancedMesh(
    mergeGeometries(parts),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    count
  );
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
