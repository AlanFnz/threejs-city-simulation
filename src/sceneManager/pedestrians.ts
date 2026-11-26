import { ResidentFigure } from './residentFigure';
import CONFIG from '../config';
import { Crosswalk } from '../city/vehicle/crosswalk';
import * as THREE from 'three';
import { ModelKey } from '../assetManager/constants';

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
  readonly crossings = new Map<THREE.Vector3, Crosswalk>();
  readonly shoppingWalks = new Map<
    Node,
    { shop: FrontDoor; points: THREE.Vector3[] }
  >();
  private landings = new Map<FrontDoor, Node>();
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
        if (sides[0] && sides[1]) {
          join(sides[0], sides[1]);
          const crossing = new Crosswalk(sides[0].point, sides[1].point);
          this.crossings.set(sides[0].point, crossing);
          this.crossings.set(sides[1].point, crossing);
        }
      }
    }
  }

  private shopLanding(shop: FrontDoor, point: THREE.Vector3): Node {
    let landing = this.landings.get(shop);
    if (!landing) {
      landing = { point, links: new Set() };
      this.landings.set(shop, landing);
      const curb = this.attach(shop.curb, shop.road);
      if (curb) join(landing, curb);
    }
    return landing;
  }

  connectShops(a: FrontDoor, b: FrontDoor, points: THREE.Vector3[]): void {
    const from = this.shopLanding(a, points[0]);
    const to = this.shopLanding(b, points[points.length - 1]);
    this.shoppingWalks.set(from, { shop: b, points: points.slice(1) });
    this.shoppingWalks.set(to, {
      shop: a,
      points: points.slice(0, -1).reverse(),
    });
    let node = from;
    for (const point of points.slice(1, -1)) {
      const bend: Node = { point, links: new Set() };
      join(node, bend);
      node = bend;
    }
    join(node, to);
  }

  shopDestination(shop: FrontDoor): Node | undefined {
    return this.landings.get(shop) ?? this.attach(shop.curb, shop.road);
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

function findShop<T>(
  start: Node,
  shops: Map<Node, T>
): { shop: T; points: THREE.Vector3[] } | undefined {
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

const WALK_SPEED = 0.27;

class Walker extends ResidentFigure {
  points: THREE.Vector3[] = [];
  distances: number[] = [];
  yaw = 0;
  elapsed = 0;
  private crossings: { crossing: Crosswalk; start: number; end: number }[] = [];
  routeId = '';

  constructor(id: string) {
    super();
    this.dress(id);
    this.visible = false;
  }

  setRoute(
    points: THREE.Vector3[],
    yaw: number,
    phase: number,
    crossings: Map<THREE.Vector3, Crosswalk>
  ): void {
    this.points = points.filter(
      (p, i) => !i || p.distanceToSquared(points[i - 1]) > 0.000001
    );
    this.distances = [0];
    this.crossings = [];
    for (let i = 1; i < this.points.length; i++) {
      this.distances.push(
        this.distances[i - 1] + this.points[i].distanceTo(this.points[i - 1])
      );
      const crossing = crossings.get(this.points[i]);
      if (crossing && crossing === crossings.get(this.points[i - 1])) {
        this.crossings.push({
          crossing,
          start: this.distances[i - 1],
          end: this.distances[i],
        });
      }
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
    return this.distances[this.distances.length - 1] / WALK_SPEED;
  }
  get cycleLength(): number {
    return 2 * this.travelTime + 9;
  }

  advance(
    dt: number,
    requested?: Set<Crosswalk>,
    occupied?: (crossing: Crosswalk) => boolean,
    approaching?: Set<Crosswalk>
  ): void {
    if (!this.points.length) {
      this.visible = false;
      return;
    }
    let next = this.elapsed + dt;
    let waiting = false;
    if (requested && occupied) {
      const travel = this.travelTime;
      const returning = this.elapsed >= travel + 5;
      for (const { crossing, start, end } of this.crossings) {
        const enter = returning
          ? 2 * travel + 5 - end / WALK_SPEED
          : start / WALK_SPEED;
        const leave = returning
          ? 2 * travel + 5 - start / WALK_SPEED
          : end / WALK_SPEED;
        if (
          next >= enter - CONFIG.VEHICLE.CROSSWALK_TRAFFIC_LEAD &&
          this.elapsed < enter
        ) {
          approaching?.add(crossing);
        }
        if (
          next < enter - CONFIG.VEHICLE.CROSSWALK_APPROACH / WALK_SPEED ||
          this.elapsed > leave + 0.06
        )
          continue;
        requested.add(crossing);
        if (this.elapsed <= enter && next >= enter && occupied(crossing)) {
          next = enter;
          waiting = true;
        }
      }
    }
    this.elapsed = next % this.cycleLength;
    const t = this.elapsed,
      travel = this.travelTime;
    const seated = t >= travel && t < travel + 5;
    const returning = t >= travel + 5;
    this.visible = t < 2 * travel + 5;
    if (!this.visible) return;
    const distance = THREE.MathUtils.clamp(
      (returning ? 2 * travel + 5 - t : t) * WALK_SPEED,
      0,
      travel * WALK_SPEED
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
    if (seated) this.sit();
    else this.gait(t * 11, !waiting);
  }
}

export class Pedestrians extends THREE.Group {
  private walkers = [
    new Walker('walker-0'),
    new Walker('walker-1'),
    new Walker('walker-2'),
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
      const node = paths.shopDestination(shop);
      if (node) shops.set(node, shop);
    }
    const trips: { points: THREE.Vector3[]; shop: FrontDoor }[] = [];
    for (const home of homes) {
      if (!shops.size || trips.length === this.walkers.length) break;
      const start = paths.attach(home.curb, home.road);
      if (!start) continue;
      // One neighbour browses both shopfronts before sitting down. Others
      // take their normal route to an available bench.
      const stroll =
        trips.length === 0 && paths.shoppingWalks.size > 0
          ? findShop(start, paths.shoppingWalks)
          : undefined;
      const trip = stroll
        ? {
            shop: stroll.shop.shop,
            points: [...stroll.points, ...stroll.shop.points],
          }
        : findShop(start, shops);
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
          trips[i] ? i * 0.12 : 0.5,
          paths.crossings
        );
      else {
        walker.points = [];
        walker.routeId = '';
        walker.visible = false;
      }
    }
  }

  readonly approaching = new Set<Crosswalk>();
  private requested = new Set<Crosswalk>();

  advance(
    dt: number,
    occupied: (crossing: Crosswalk) => boolean
  ): ReadonlySet<Crosswalk> {
    this.requested.clear();
    this.approaching.clear();
    for (const walker of this.walkers)
      walker.advance(dt, this.requested, occupied, this.approaching);
    return this.requested;
  }
}
