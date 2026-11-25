import * as THREE from 'three';
import { ModelKey } from '../assetManager/constants';
import { SIDES } from '../assetManager/frontage';
import type { FrontDoor } from './pedestrians';

export interface ShopFront extends FrontDoor {
  x: number;
  z: number;
  facing: number;
  matrix: THREE.Matrix4;
  modelKey: ModelKey;
}

const WALK_DEPTH = 0.59;
const WALK_HALF_WIDTH = 0.085;
const PAVEMENT_Y = 0.017;

function landing(shop: ShopFront): THREE.Vector3 {
  const normal = SIDES[shop.facing];
  const depth = (p: THREE.Vector3) =>
    (p.x - shop.x) * normal.x + (p.z - shop.z) * normal.y;
  const t =
    (WALK_DEPTH - depth(shop.door)) / (depth(shop.curb) - depth(shop.door));
  const point = shop.door
    .clone()
    .lerp(shop.curb, THREE.MathUtils.clamp(t, 0, 1));
  point.y = PAVEMENT_Y + 0.003;
  return point;
}

// Connect neighbours along the same street, including the last shop when
// its entrance turns the corner. Require the streets around that corner.
export function promenadeRoute(
  a: ShopFront,
  b: ShopFront,
  isRoad: (x: number, z: number) => boolean
): THREE.Vector3[] {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return [];
  const na = SIDES[a.facing];
  const from = landing(a),
    to = landing(b);
  if (a.facing === b.facing) {
    return na.x * dx + na.y * dz === 0 ? [from, to] : [];
  }
  // 'along' faces the shared street; 'corner' faces the intersecting road.
  const aAlong = na.x * dx + na.y * dz === 0;
  const along = aAlong ? a : b,
    corner = aAlong ? b : a;
  const street = SIDES[along.facing],
    end = SIDES[corner.facing];
  if (
    street.x * end.x + street.y * end.y !== 0 ||
    end.x !== corner.x - along.x ||
    end.y !== corner.z - along.z ||
    !isRoad(corner.x + street.x, corner.z + street.y) ||
    !isRoad(corner.x + street.x + end.x, corner.z + street.y + end.y)
  )
    return [];
  const bend = from.clone();
  if ((aAlong && dx !== 0) || (!aAlong && dz !== 0)) bend.x = to.x;
  else bend.z = to.z;
  return [from, bend, to];
}

type Point = readonly [number, number, number];

class Surface {
  positions: number[] = [];
  colors: number[] = [];
  private tint = new THREE.Color();

  quad(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    color: number,
    matrix?: THREE.Matrix4
  ): void {
    this.tint.setHex(color);
    const point = new THREE.Vector3();
    for (const vertex of [a, b, c, a, c, d]) {
      point.set(...vertex);
      if (matrix) point.applyMatrix4(matrix);
      this.positions.push(point.x, point.y, point.z);
      this.colors.push(this.tint.r, this.tint.g, this.tint.b);
    }
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(this.positions, 3)
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(this.colors, 3)
    );
    geometry.computeVertexNormals();
    return geometry;
  }
}

const stones = [0xd4bca1, 0xe0cbb1, 0xceb499, 0xdcc5ac];
function pave(surface: Surface, a: THREE.Vector3, b: THREE.Vector3): void {
  const length = a.distanceTo(b);
  if (length < 0.001) return;
  const dx = (b.x - a.x) / length,
    dz = (b.z - a.z) / length;
  const point = (s: number, t: number, y: number): Point => [
    a.x + s * dx - t * dz,
    y,
    a.z + s * dz + t * dx,
  ];
  const slab = (
    start: number,
    finish: number,
    left: number,
    right: number,
    y: number,
    color: number
  ) => {
    surface.quad(
      point(start, left, y),
      point(start, right, y),
      point(finish, right, y),
      point(finish, left, y),
      color
    );
  };
  const w = WALK_HALF_WIDTH;
  slab(0, length, -w, w, PAVEMENT_Y, 0xa98870);
  // A running bond and a continuous contrasting edge read even at oblique angles.
  for (let row = 0; row < 2; row++) {
    const lo = -w + 0.009 + row * (w - 0.009),
      hi = lo + w - 0.009;
    let start = 0;
    for (let i = 0; start < length; i++) {
      const finish = Math.min(length, start + (i === 0 && row ? 0.076 : 0.152));
      if (finish - start > 0.003)
        slab(
          start + 0.001,
          finish - 0.001,
          lo + 0.001,
          hi - 0.001,
          PAVEMENT_Y + 0.001,
          stones[(i + row * 2) % stones.length]
        );
      start = finish;
    }
  }
}

// Measured on the baked shop models. Leave the low burger stand's existing canopy clear.
const awnings: Partial<
  Record<ModelKey, readonly [number, number, number, number]>
> = {
  // centre X, wall Z, mounting height, fabric width
  [ModelKey.COMMERCIAL_A1]: [0.065, 0.145, 0.194, 0.16],
  [ModelKey.COMMERCIAL_C1]: [-0.032, 0.16, 0.202, 0.25],
  [ModelKey.COMMERCIAL_A2]: [0, 0.128, 0.174, 0.27],
  [ModelKey.COMMERCIAL_B2]: [0, 0.092, 0.2, 0.26],
  [ModelKey.COMMERCIAL_C2]: [0.06, 0.225, 0.208, 0.18],
  [ModelKey.COMMERCIAL_A3]: [0, 0.215, 0.224, 0.34],
  [ModelKey.COMMERCIAL_B3]: [0, 0.194, 0.224, 0.36],
  [ModelKey.COMMERCIAL_C3]: [0, 0.303, 0.224, 0.35],
};
const dyes = [0xb55640, 0x39776d, 0xc08d39];

function canopy(surface: Surface, shop: ShopFront): void {
  const fit = awnings[shop.modelKey];
  if (!fit) return;
  const [x, z, h, width] = fit;
  const trim = dyes[(shop.x + 2 * shop.z) % dyes.length];
  const lip = z + 0.145;
  for (let i = 0; i < 7; i++) {
    const l = x - width / 2 + (width * i) / 7,
      r = x - width / 2 + (width * (i + 1)) / 7;
    const color = i % 2 ? 0xffe8bb : trim;
    surface.quad(
      [l, h, z],
      [l, h - 0.033, lip],
      [r, h - 0.033, lip],
      [r, h, z],
      color,
      shop.matrix
    );
    surface.quad(
      [l, h - 0.033, lip],
      [l, h - 0.047, lip],
      [r, h - 0.047, lip],
      [r, h - 0.033, lip],
      color,
      shop.matrix
    );
    const mid = (l + r) / 2;
    surface.quad(
      [l, h - 0.047, lip],
      [mid - 0.004, h - 0.052, lip],
      [mid + 0.004, h - 0.052, lip],
      [r, h - 0.047, lip],
      color,
      shop.matrix
    );
  }
}

function batch(
  castShadow: boolean
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> {
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    })
  );
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.userData.nonInteractive = true;
  mesh.raycast = () => {};
  return mesh;
}

export class Promenade extends THREE.Group {
  private paving = batch(false);
  private canopies = batch(true);

  constructor() {
    super();
    this.add(this.paving, this.canopies);
  }

  rebuild(
    stores: ShopFront[],
    isRoad: (x: number, z: number) => boolean,
    connect: (a: ShopFront, b: ShopFront, points: THREE.Vector3[]) => void
  ): void {
    const pavement = new Surface(),
      cloth = new Surface();
    const fronts = new Map(
      stores.map((store) => [store.x + ',' + store.z, store])
    );
    for (const a of stores) {
      canopy(cloth, a);
      for (const key of [a.x + 1 + ',' + a.z, a.x + ',' + (a.z + 1)]) {
        const b = fronts.get(key);
        if (!b) continue;
        const points = promenadeRoute(a, b, isRoad);
        if (!points.length) continue;
        connect(a, b, points);
        for (let i = 1; i < points.length; i++) {
          // Finish the right-angle corner with a square stone instead of
          // overlapping the two strips of paving.
          const start = points[i - 1].clone(),
            end = points[i].clone();
          const direction = end.clone().sub(start).normalize();
          if (i > 1) start.addScaledVector(direction, WALK_HALF_WIDTH);
          if (i < points.length - 1)
            end.addScaledVector(direction, -WALK_HALF_WIDTH);
          pave(pavement, start, end);
        }
        if (points.length === 3) {
          const { x, z } = points[1],
            w = WALK_HALF_WIDTH,
            y = PAVEMENT_Y + 0.001;
          pavement.quad(
            [x - w, y, z - w],
            [x - w, y, z + w],
            [x + w, y, z + w],
            [x + w, y, z - w],
            0xc9ac8c
          );
        }
      }
    }
    for (const [mesh, surface] of [
      [this.paving, pavement],
      [this.canopies, cloth],
    ] as const) {
      mesh.geometry.dispose();
      mesh.geometry = surface.geometry();
      mesh.visible = surface.positions.length > 0;
    }
  }
}
