import * as THREE from 'three';
import { ModelKey } from '../assetManager/constants';
import { coloredShape } from './coast';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Node = { point: THREE.Vector3; links: Set<Node> };
type Face = { triangle: THREE.Triangle; center: Node };
export type BenchStop = {
  approach: THREE.Vector3;
  seat: THREE.Vector3;
  yaw: number;
};
export type FrontDoor = {
  door: THREE.Vector3;
  curb: THREE.Vector3;
  road: THREE.Matrix4;
  stop?: BenchStop;
};

function join(a: Node, b: Node): void {
  a.links.add(b);
  b.links.add(a);
}

// Neighbouring triangles meet at the middle of their shared edge. This also
// stitches the sidewalk meshes together at the seams between road tiles.
export class Footpaths {
  private edges = new Map<string, Node>();
  private roads = new Map<THREE.Matrix4, Face[]>();

  addRoad(
    road: THREE.Matrix4,
    model: ModelKey,
    surface: THREE.Triangle[]
  ): void {
    const faces = surface.map((local) => {
      const [a, b, c] = [local.a, local.b, local.c].map((p) => {
        const world = p.clone().applyMatrix4(road);
        world.y = 0.018;
        return world;
      });
      const triangle = new THREE.Triangle(a, b, c);
      const center: Node = {
        point: triangle.getMidpoint(new THREE.Vector3()),
        links: new Set(),
      };
      for (const [from, to] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const point = from.clone().lerp(to, 0.5);
        const key =
          Math.round(point.x * 10000) + ',' + Math.round(point.z * 10000);
        let edge = this.edges.get(key);
        if (!edge) {
          edge = { point, links: new Set() };
          this.edges.set(key, edge);
        }
        join(center, edge);
      }
      return { triangle, center };
    });
    this.roads.set(road, faces);
    if (model === ModelKey.ROAD_TEE || model === ModelKey.ROAD_INTERSECTION) {
      for (const [x, z] of [
        [0.18, 0],
        [-0.18, 0],
        [0, 0.18],
        ...(model === ModelKey.ROAD_INTERSECTION ? [[0, -0.18]] : []),
      ]) {
        const acrossX = z !== 0;
        const sides = [-0.14, 0.14].map((offset) =>
          this.attach(
            new THREE.Vector3(
              x + (acrossX ? offset : 0),
              0,
              z + (acrossX ? 0 : offset)
            ).applyMatrix4(road),
            road
          )
        );
        if (sides[0] && sides[1]) join(sides[0], sides[1]);
      }
    }
  }

  attach(point: THREE.Vector3, road: THREE.Matrix4): Node | undefined {
    let nearest: Node | undefined;
    let distance = Infinity;
    const position = new THREE.Vector3(),
      sample = new THREE.Vector3();
    for (const face of this.roads.get(road) ?? []) {
      face.triangle.closestPointToPoint(point, sample);
      const d = point.distanceToSquared(sample);
      if (d >= distance) continue;
      distance = d;
      nearest = face.center;
      position.copy(sample);
    }
    if (!nearest) return;
    const node: Node = { point: position, links: new Set() };
    join(node, nearest);
    return node;
  }
}

function findShop(
  start: Node,
  shops: Map<Node, FrontDoor>
): { shop: FrontDoor; points: THREE.Vector3[] } | undefined {
  const queue = [start],
    previous = new Map<Node, Node | null>([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i],
      shop = shops.get(node);
    if (shop) {
      const points = [];
      for (let p: Node | null = node; p; p = previous.get(p)!)
        points.push(p.point);
      return { shop, points: points.reverse() };
    }
    for (const next of node.links) {
      if (previous.has(next)) continue;
      previous.set(next, node);
      queue.push(next);
    }
  }
}

const block = new THREE.BoxGeometry(1, 1, 1);
const skin = new THREE.SphereGeometry(0.018, 7, 5);
const fabric = new THREE.MeshLambertMaterial({ vertexColors: true });
const pants = new THREE.MeshLambertMaterial({ color: 0x334654 });
const leg = new THREE.BoxGeometry(0.016, 0.048, 0.018).translate(0, -0.024, 0);

class Walker extends THREE.Group {
  readonly legs = [new THREE.Mesh(leg, pants), new THREE.Mesh(leg, pants)];
  points: THREE.Vector3[] = [];
  distances: number[] = [];
  yaw = 0;
  elapsed = 0;
  routeId = '';

  constructor(shirt: number, complexion: number) {
    super();
    const body = new THREE.Mesh(
      mergeGeometries([
        coloredShape(block, shirt, 0, 0.074, 0, 0.047, 0.057, 0.03),
        coloredShape(skin, complexion, 0, 0.12, 0),
        coloredShape(block, 0x453832, 0, 0.133, -0.002, 0.03, 0.012, 0.028),
      ]),
      fabric
    );
    body.castShadow = true;
    this.add(body, ...this.legs);
    this.legs.forEach((part, i) =>
      part.position.set(i ? 0.012 : -0.012, 0.05, 0)
    );
    this.visible = false;
    this.traverse((o) => {
      o.userData.nonInteractive = true;
      o.raycast = () => {};
    });
  }

  setRoute(points: THREE.Vector3[], yaw: number, phase: number): void {
    this.points = points.filter(
      (p, i) => !i || p.distanceToSquared(points[i - 1]) > 0.000001
    );
    this.distances = [0];
    for (let i = 1; i < this.points.length; i++) {
      this.distances.push(
        this.distances[i - 1] + this.points[i].distanceTo(this.points[i - 1])
      );
    }
    this.yaw = yaw;
    const id = this.points
      .map((p) => p.x.toFixed(3) + ',' + p.z.toFixed(3))
      .join('/');
    if (this.routeId !== id) this.elapsed = this.cycleLength * phase;
    this.routeId = id;
    this.advance(0);
  }

  get travelTime(): number {
    return this.distances[this.distances.length - 1] / 0.27;
  }
  get cycleLength(): number {
    return 2 * this.travelTime + 9;
  }

  advance(dt: number): void {
    if (!this.points.length) {
      this.visible = false;
      return;
    }
    this.elapsed = (this.elapsed + dt) % this.cycleLength;
    const t = this.elapsed,
      travel = this.travelTime;
    const seated = t >= travel && t < travel + 5;
    const returning = t >= travel + 5;
    this.visible = t < 2 * travel + 5;
    if (!this.visible) return;
    const distance = THREE.MathUtils.clamp(
      (returning ? 2 * travel + 5 - t : t) * 0.27,
      0,
      travel * 0.27
    );
    let i = 1;
    while (i < this.points.length - 1 && distance > this.distances[i]) i++;
    const a = this.points[i - 1],
      b = this.points[i];
    this.position.lerpVectors(
      a,
      b,
      THREE.MathUtils.clamp(
        (distance - this.distances[i - 1]) /
          (this.distances[i] - this.distances[i - 1]),
        0,
        1
      )
    );
    this.rotation.y = seated
      ? this.yaw
      : Math.atan2(b.x - a.x, b.z - a.z) + (returning ? Math.PI : 0);
    this.legs.forEach((part, index) => {
      part.rotation.x = seated
        ? -1.4
        : Math.sin(t * 12 + index * Math.PI) * 0.43;
    });
  }
}

export class Pedestrians extends THREE.Group {
  private walkers = [
    new Walker(0xce654b, 0xe9b88b),
    new Walker(0xe5ae4f, 0x986a4a),
    new Walker(0x59899d, 0xd19c75),
  ];

  constructor() {
    super();
    this.add(...this.walkers);
  }

  updateRoutes(
    paths: Footpaths,
    homes: FrontDoor[],
    stores: FrontDoor[]
  ): void {
    const shops = new Map<Node, FrontDoor>();
    for (const shop of stores) {
      const node = paths.attach(shop.curb, shop.road);
      if (node) shops.set(node, shop);
    }
    const trips: { points: THREE.Vector3[]; shop: FrontDoor }[] = [];
    for (const home of homes) {
      if (!shops.size || trips.length === this.walkers.length) break;
      const start = paths.attach(home.curb, home.road);
      const trip = start && findShop(start, shops);
      if (!trip) continue;
      const stop = trip.shop.stop!;
      trips.push({
        points: [home.door, ...trip.points, stop.approach, stop.seat],
        shop: trip.shop,
      });
      for (const [key, shop] of shops)
        if (shop === trip.shop) shops.delete(key);
    }
    for (const [i, walker] of this.walkers.entries()) {
      // A second neighbour can use the same bench half a circuit later.
      const trip =
        trips[i] ?? (i === 1 && trips.length === 1 ? trips[0] : undefined);
      if (trip)
        walker.setRoute(
          trip.points,
          trip.shop.stop!.yaw,
          trips[i] ? i * 0.12 : 0.5
        );
      else {
        walker.points = [];
        walker.routeId = '';
        walker.visible = false;
      }
    }
  }

  advance(dt: number): void {
    for (const walker of this.walkers) walker.advance(dt);
  }
}
