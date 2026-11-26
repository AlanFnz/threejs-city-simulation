import type { Citizen } from '../city/citizen';
import {
  estimatedHomecoming,
  residentSpread,
  shiftEnd,
} from './householdLights';
import type { ICity } from '../city';
import CONFIG from '../config';
import { Crosswalk } from '../city/vehicle/crosswalk';
import * as THREE from 'three';
import { ModelKey } from '../assetManager/constants';
import { ResidentFigure } from './residentFigure';

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

export type StreetDoor = FrontDoor & { x: number; z: number };

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

function findDestination<T>(
  start: Node,
  destinations: Map<Node, T>,
  radius = Infinity
): { destination: T; points: THREE.Vector3[] } | undefined {
  const queue = [start],
    previous = new Map<Node, Node | null>([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i],
      destination = destinations.get(node);
    if (destination) {
      const points = [];
      for (let p: Node | null = node; p; p = previous.get(p)!)
        points.push(p.point);
      return { destination, points: points.reverse() };
    }
    for (const next of node.links) {
      if (
        previous.has(next) ||
        start.point.distanceToSquared(next.point) > radius * radius
      )
        continue;
      previous.set(next, node);
      queue.push(next);
    }
  }
}

const WALK_SPEED = 0.33;
const MAX_SHOPPING_DISTANCE = 5; // sidewalk tiles, one way

type Walk = {
  purpose: 'work' | 'shopping';
  points: THREE.Vector3[];
  stop?: BenchStop;
};

const bagMaterial = new THREE.MeshLambertMaterial({ color: 0xc28c50 });
const bagShape = new THREE.BoxGeometry(0.22, 0.27, 0.125);

class Walker extends ResidentFigure {
  private bag = new THREE.Mesh(bagShape, bagMaterial);
  private walk?: Walk;
  private points: THREE.Vector3[] = [];
  private distances: number[] = [];
  resident = '';
  private departs = 0;
  private dwell = 0;
  private elapsed = 0;
  homeArrival = Infinity;

  get isCommute(): boolean {
    return this.walk?.purpose === 'work';
  }
  private crossings: { crossing: Crosswalk; start: number; end: number }[] = [];

  constructor() {
    super();
    this.bag.position.set(0.035, -0.425, 0.035);
    this.bag.userData.nonInteractive = true;
    this.bag.raycast = () => {};
    this.forearms[1].add(this.bag);
    this.visible = false;
  }

  assign(
    resident: string,
    walk: Walk,
    minute: number,
    reset: boolean,
    crossings: Footpaths['crossings']
  ): void {
    if (this.walk === walk && this.resident === resident && !reset) return;
    // A road edit rebuilds the graph, including crossing objects. Keep the
    // pose on an unchanged itinerary, but always refresh those references.
    const points = walk.points.filter(
      (p, i, all) => !i || p.distanceToSquared(all[i - 1]) > 0.000001
    );
    const keepTime =
      !reset &&
      resident === this.resident &&
      walk.purpose === this.walk?.purpose &&
      !!walk.stop === !!this.walk.stop &&
      points.length === this.points.length &&
      points.every((p, i) => p.distanceToSquared(this.points[i]) < 0.000001);
    this.points = points;
    this.walk = walk;
    this.resident = resident;
    this.dress(resident);
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
    // Give each saved resident the same timetable on every visit.
    const spread = residentSpread(resident);
    const shopping = walk.purpose === 'shopping';
    this.departs = shopping ? 10.75 * 60 + spread * 105 : 7 * 60 + spread * 120;
    this.dwell = shopping
      ? 3 + spread * 2
      : Math.max(
          0,
          (shiftEnd(spread) - this.departs) / CONFIG.CITY.MINUTES_PER_TICK -
            this.travelTime
        );
    if (!keepTime) {
      this.elapsed = (minute - this.departs) / CONFIG.CITY.MINUTES_PER_TICK;
      const tripDuration = 2 * this.travelTime + this.dwell;
      this.homeArrival =
        this.elapsed >= tripDuration
          ? this.departs + tripDuration * CONFIG.CITY.MINUTES_PER_TICK
          : Infinity;
    }
    this.advance(0, minute);
  }

  unassign(): void {
    this.walk = undefined;
    this.resident = '';
    this.visible = false;
  }

  private get travelTime(): number {
    return this.distances[this.distances.length - 1] / WALK_SPEED;
  }

  advance(
    dt: number,
    minute: number,
    requested?: Set<Crosswalk>,
    occupied?: (crossing: Crosswalk) => boolean,
    approaching?: Set<Crosswalk>
  ): void {
    if (!this.walk) return;
    const clockElapsed = (minute - this.departs) / CONFIG.CITY.MINUTES_PER_TICK;
    const travel = this.travelTime;
    const returnStart = travel + this.dwell;
    let next = this.elapsed + dt;
    if (this.elapsed < 0) next = Math.min(0, clockElapsed);
    // An inbound crossing delay shortens the shift inside the building.
    if (
      this.walk.purpose === 'work' &&
      this.elapsed >= travel &&
      this.elapsed < returnStart
    )
      next = Math.min(returnStart, Math.max(this.elapsed, clockElapsed));
    let waiting = false;
    if (requested && occupied) {
      const returning = this.elapsed >= returnStart;
      for (const { crossing, start, end } of this.crossings) {
        const enter = returning
          ? returnStart + travel - end / WALK_SPEED
          : start / WALK_SPEED;
        const leave = returning
          ? returnStart + travel - start / WALK_SPEED
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
    const t = (this.elapsed = next);
    if (t >= returnStart + travel && !Number.isFinite(this.homeArrival))
      this.homeArrival = minute;
    const visiting = t >= travel && t < returnStart;
    const seated = visiting && !!this.walk.stop;
    const returning = t >= returnStart;
    this.visible = t >= 0 && t < returnStart + travel && (!visiting || seated);
    if (!this.visible) return;
    this.bag.visible = returning && this.walk.purpose === 'shopping';
    const distance = THREE.MathUtils.clamp(
      (returning ? returnStart + travel - t : t) * WALK_SPEED,
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
      ? this.walk.stop!.yaw
      : Math.atan2(b.x - a.x, b.z - a.z) + (returning ? Math.PI : 0);
    if (seated) this.sit();
    else this.gait(t * 11, !waiting);
  }
}

const MAX_WALKERS = 32;

export class Pedestrians extends THREE.Group {

  private walkers: Walker[] = [];
  private paths = new Footpaths();
  private homes = new Map<StreetDoor, Node>();
  private workplaces = new Map<string, { node: Node; door: StreetDoor }>();
  private shops = new Map<Node, FrontDoor>();
  private routes = new Map<string, Walk | null>();
  private minute = 0;
  private sinceTick = 0;

  setNetwork(
    paths: Footpaths,
    homes: StreetDoor[],
    workplaces: StreetDoor[],
    shops: StreetDoor[]
  ): void {
    this.paths = paths;
    this.routes.clear();
    this.homes.clear();
    this.workplaces.clear();
    this.shops.clear();
    // Keep the busiest frontages in each neighborhood, then sample neighborhoods
    // in turn so the walker budget also reaches the edges of a larger city.
    const counts = new Map<string, number>();
    const order = homes
      .map((door) => {
        const key = Math.floor(door.x / 8) + ',' + Math.floor(door.z / 8);
        const rank = counts.get(key) ?? 0;
        counts.set(key, rank + 1);
        return { door, rank };
      })
      .sort((a, b) => a.rank - b.rank);
    for (const { door } of order) {
      const node = paths.attach(door.curb, door.road);
      if (node) this.homes.set(door, node);
    }
    for (const door of workplaces) {
      const node = paths.attach(door.curb, door.road);
      if (node) this.workplaces.set(door.x + ',' + door.z, { node, door });
    }
    for (const shop of shops) {
      const node = paths.shopDestination(shop);
      if (node && shop.stop) this.shops.set(node, shop);
    }
  }

  private route(
    home: StreetDoor,
    start: Node,
    destination: string
  ): Walk | null {
    const key = home.x + ',' + home.z + '/' + destination;
    if (this.routes.has(key)) return this.routes.get(key)!;
    let walk: Walk | null = null;
    if (
      destination === 'shop' ||
      destination === 'promenade' ||
      destination === 'errand'
    ) {
      const stroll =
        destination === 'promenade' && this.paths.shoppingWalks.size
          ? findDestination(
              start,
              this.paths.shoppingWalks,
              MAX_SHOPPING_DISTANCE
            )
          : undefined;
      const visit = stroll
        ? {
            destination: stroll.destination.shop,
            points: [...stroll.points, ...stroll.destination.points],
          }
        : destination !== 'promenade' && this.shops.size
          ? findDestination(start, this.shops, MAX_SHOPPING_DISTANCE)
          : undefined;
      if (
        visit &&
        !(destination === 'errand' && visit.destination.door.equals(home.door))
      ) {
        const stop =
          destination === 'errand' ? undefined : visit.destination.stop;
        const points = [
          home.door,
          ...visit.points,
          ...(stop ? [stop.approach, stop.seat] : [visit.destination.door]),
        ];
        const distance = points.reduce(
          (sum, p, i) => (i ? sum + p.distanceTo(points[i - 1]) : sum),
          0
        );
        if (distance <= MAX_SHOPPING_DISTANCE)
          walk = { points, stop, purpose: 'shopping' };
      }
    } else {
      const job = this.workplaces.get(destination);
      const trip =
        job && findDestination(start, new Map([[job.node, job.door]]));
      if (trip)
        walk = {
          purpose: 'work',
          points: [home.door, ...trip.points, trip.destination.door],
        };
    }
    this.routes.set(key, walk);
    return walk;
  }


  updateResidents(city: ICity, minute: number, restoreClock = false): void {
    const reset =
      restoreClock ||
      minute < this.minute ||
      minute - this.minute > CONFIG.CITY.MINUTES_PER_TICK;
    if (reset || this.minute !== minute) this.sinceTick = 0;
    this.minute = minute;
    const outings = new Map<string, Walk>();
    const seats = new Set<BenchStop>();
    // Sample occupied homes only. A house contributes at most one commute
    // and one lunch outing, and two neighbours never claim the same seat.
    for (const [home, start] of this.homes) {
      if (outings.size >= MAX_WALKERS) break;
      const building = city.getTile(home.x, home.z)?.building;
      if (!building || !('residents' in building)) continue;
      const residents = building.residents.all;
      for (const worker of residents) {
        const job = worker.workplace;
        if (!job) continue;
        const walk = this.route(home, start, job.x + ',' + job.y);
        if (!walk) continue;
        outings.set(worker.id, walk);
        break;
      }
      if (outings.size >= MAX_WALKERS || !this.shops.size) continue;
      const shopper = residents.find(
        (person) =>
          !outings.has(person.id) &&
          person.age >= CONFIG.CITIZEN.MIN_WORKING_AGE
      );
      if (!shopper) continue;
      // Employees take their lunch break from their workplace.
      const job = shopper.workplace;
      const origin = job
        ? this.workplaces.get(job.x + ',' + job.y)
        : { door: home, node: start };
      if (!origin) continue;
      for (const destination of ['promenade', 'shop', 'errand']) {
        if (destination !== 'errand' && seats.size === this.shops.size)
          continue;
        const walk = this.route(origin.door, origin.node, destination);
        if (!walk || (walk.stop && seats.has(walk.stop))) continue;
        if (walk.stop) seats.add(walk.stop);
        outings.set(shopper.id, walk);
        break;
      }
    }
    for (const walker of this.walkers) {
      const walk = outings.get(walker.resident);
      if (walk) {
        walker.assign(
          walker.resident,
          walk,
          minute,
          reset,
          this.paths.crossings
        );
        outings.delete(walker.resident);
      } else walker.unassign();
    }
    for (const [id, walk] of outings) {
      let walker = this.walkers.find((person) => !person.resident);
      if (!walker) {
        walker = new Walker();
        this.walkers.push(walker);
        this.add(walker);
      }
      walker.assign(id, walk, minute, reset, this.paths.crossings);
    }
  }

  get streetMinute(): number {
    return this.minute + this.sinceTick * CONFIG.CITY.MINUTES_PER_TICK;
  }

  readonly homeSince = (person: Citizen): number => {
    const walker = this.walkers.find((w) => w.resident === person.id);
    if (walker && (walker.isCommute || !person.workplace))
      return walker.homeArrival;
    return estimatedHomecoming(person);
  };

  readonly approaching = new Set<Crosswalk>();
  private requested = new Set<Crosswalk>();

  advance(
    dt: number,
    occupied: (crossing: Crosswalk) => boolean,
    stepsPerSecond = 1
  ): ReadonlySet<Crosswalk> {
    this.requested.clear();
    this.approaching.clear();
    // A 3× scheduler tick advances three simulation steps at once.
    this.sinceTick = Math.max(
      this.sinceTick,
      Math.min(stepsPerSecond, this.sinceTick + dt)
    );
    const minute = this.streetMinute;
    for (const walker of this.walkers) {
      walker.advance(dt, minute, this.requested, occupied, this.approaching);
    }
    return this.requested;
  }
}
