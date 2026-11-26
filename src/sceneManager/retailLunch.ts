import type { SidewalkSource } from '../audio/sidewalkAudio';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CONFIG from '../config';
import { shutterOpening } from './shopShutters';
import { METERS_PER_TILE } from '../assetManager/worldScale';
import type { ICity } from '../city';
import type { Citizen } from '../city/citizen';
import type { Crosswalk } from '../city/vehicle/crosswalk';
import { coloredShape } from './coast';
import type { StreetDoor, BenchStop } from './pedestrians';
import { ResidentFigure } from './residentFigure';
import { SidewalkWalk } from './sidewalkWalk';

const { LUNCH } = CONFIG;
const box = new THREE.BoxGeometry();
const oval = new THREE.SphereGeometry(1, 10, 7);
const paint = new THREE.MeshLambertMaterial({ vertexColors: true });
const bread = mergeGeometries([
  coloredShape(oval, 0xb87a39, 0, 0, 0, 0.1, 0.036, 0.067),
  coloredShape(oval, 0x679051, 0, 0.025, 0, 0.102, 0.017, 0.068),
  coloredShape(oval, 0xe5b66b, 0, 0.055, 0, 0.098, 0.034, 0.065),
  coloredShape(box, 0xffedd0, -0.048, 0.016, 0, 0.096, 0.09, 0.135),
]);
const paperBag = mergeGeometries([
  coloredShape(box, 0xd2a167, 0, -0.17, 0, 0.24, 0.27, 0.135),
  ...[-1, 1].map((s) =>
    coloredShape(
      new THREE.TorusGeometry(0.055, 0.007, 5, 12),
      0x976e43,
      0,
      -0.043,
      s * 0.048
    )
  ),
]);
const counterTop = mergeGeometries([
  coloredShape(box, 0x416c63, 0, 0.44, 0, 1.16, 0.81, 0.52),
  coloredShape(box, 0xc28d5e, 0, 0.89, 0, 1.27, 0.09, 0.6),
  coloredShape(box, 0xf0d197, 0, 0.67, 0.27, 1.05, 0.055, 0.022),
  coloredShape(box, 0x454f50, -0.38, 1.01, -0.05, 0.24, 0.16, 0.2),
  coloredShape(box, 0xc9d3bf, 0.22, 0.96, 0.02, 0.5, 0.045, 0.3),
  ...[-0.11, 0.13].map((x) =>
    coloredShape(oval, 0xe0b678, 0.21 + x, 1.025, 0.03, 0.1, 0.054, 0.075)
  ),
]);

export function queueEntrance(shop: StreetDoor) {
  const out = shop.curb.clone().sub(shop.door).setY(0).normalize();
  const point = shop.door.clone().addScaledVector(out, 0.29);
  point.x -= out.z * 0.026;
  point.z += out.x * 0.026;
  return point;
}
function prop(geometry: THREE.BufferGeometry) {
  const m = new THREE.Mesh(geometry, paint);
  m.castShadow = m.userData.nonInteractive = true;
  m.raycast = () => {};
  m.visible = false;
  return m;
}

export type LunchRoute = {
  origin: StreetDoor;
  shop: StreetDoor;
  path: SidewalkWalk;
};
type Guest = { person: Citizen; route: LunchRoute };
type Phase =
  | 'away'
  | 'approaching'
  | 'queued'
  | 'ordering'
  | 'takeaway'
  | 'toBench'
  | 'eating'
  | 'returning';

class Customer extends ResidentFigure {
  readonly bag = prop(paperBag);
  private food = prop(bread);
  phase: Phase = 'away';
  inboundDelay = 0;
  outboundDelay = 0;
  orderStart = 0;
  orderEnd = 0;
  constructor(
    readonly guest: Guest,
    readonly arrival: number,
    readonly lunchOnBench: boolean
  ) {
    super();
    this.dress(guest.person.id);
    this.name = guest.person.id;
    this.bag.name = 'Paper bag';
    this.food.name = 'Sandwich';
    this.forearms[1].add(this.bag, this.food);
    this.bag.position.set(0.015, -0.276, 0);
    this.food.position.set(0, -0.28, 0.035);
    this.visible = false;
  }
  pose(phase: Phase, minute: number, moving = false) {
    this.phase = phase;
    this.visible = phase !== 'away';
    this.bag.visible =
      phase === 'takeaway' || (phase === 'returning' && !this.lunchOnBench);
    this.food.visible = phase === 'toBench' || phase === 'eating';
    if (!this.visible) return;
    if (phase === 'eating') {
      this.sit();
      const bite = 0.5 + 0.5 * Math.cos(minute * 0.23);
      this.arms[1].rotation.x = -0.5 - 0.35 * bite;
      this.forearms[1].rotation.x = -1.08 - 0.69 * bite;
      this.torso.rotation.x = 0.04 + 0.045 * bite;
    } else {
      this.gait(minute * 0.78, moving);
      if (phase === 'ordering') {
        this.arms[1].rotation.x = -0.45;
        this.forearms[1].rotation.x = -0.44 - 0.3 * Math.sin(minute * 0.55);
      } else if (phase === 'toBench') this.forearms[1].rotation.x = -1.07;
    }
  }
}
class Shopkeeper extends ResidentFigure {
  private parcel = prop(paperBag);
  private sandwich = prop(bread);
  constructor() {
    super();
    this.forearms[0].add(this.parcel, this.sandwich);
    this.parcel.position.y = this.sandwich.position.y = -0.26;
  }
  serve(minute: number, end?: number, meal = false) {
    const handoff = end !== undefined && end - minute < 5;
    this.parcel.visible = handoff && !meal;
    this.sandwich.visible = handoff && meal;
    this.gait(0, false);
    this.arms[0].rotation.x = handoff ? -1.05 : -0.52;
    this.forearms[0].rotation.x = -0.52 - 0.43 * Math.sin(minute * 0.48);
  }
}

const lunchVoices: Partial<Record<Phase, number>> = {
  queued: 0.48,
  ordering: 0.9,
  eating: 0.26,
};

const clamp = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
const key = (f: { x: number; z: number }) => f.x + ',' + f.z;
const JOIN = 5,
  STEP = 4,
  LEAVE = 9;

// Hold a group at the curb while a vehicle is on the stripes. The delayed
// arrival goes back into the shop's queue in the order customers actually arrive.
function crossingDelay(
  path: SidewalkWalk,
  start: number,
  back: boolean,
  before: number,
  now: number,
  delay: number,
  requested: Set<Crosswalk>,
  occupied: (c: Crosswalk) => boolean,
  approaching: Set<Crosswalk>
) {
  for (const { from, to, crossing } of path.crossings) {
    const enter =
      start + (back ? path.length - to : from) * LUNCH.WALK_MINUTES_PER_TILE;
    const leave =
      start + (back ? path.length - from : to) * LUNCH.WALK_MINUTES_PER_TILE;
    if (
      before - delay > leave + 1 ||
      now - delay <
        enter -
          CONFIG.VEHICLE.CROSSWALK_TRAFFIC_LEAD * CONFIG.CITY.MINUTES_PER_TICK
    )
      continue;
    if (before - delay < enter) approaching.add(crossing);
    if (
      now - delay <
      enter - CONFIG.VEHICLE.CROSSWALK_APPROACH * LUNCH.WALK_MINUTES_PER_TILE
    )
      continue;
    requested.add(crossing);
    if (before - delay <= enter && now - delay >= enter && occupied(crossing))
      delay = now - enter;
  }
  return delay;
}

class LunchCounter extends THREE.Group {
  readonly customers: Customer[];
  private clerk = new Shopkeeper();
  private clock = 0;
  private approach: THREE.Vector3;
  private outward: THREE.Vector3;
  private stand = prop(counterTop);
  private head: THREE.Vector3;
  private exit: SidewalkWalk;
  private benchWalk: SidewalkWalk;
  private fromBench: SidewalkWalk;
  constructor(
    public shop: StreetDoor,
    readonly seller: Citizen,
    guests: Guest[]
  ) {
    super();
    const stop = shop.stop!;
    this.outward = shop.curb.clone().sub(shop.door).setY(0).normalize();
    const sideways = new THREE.Vector3(this.outward.z, 0, -this.outward.x);
    // Keep the queue on one side of the paved entrance and the exit on the other.
    this.head = shop.door
      .clone()
      .addScaledVector(this.outward, 0.124)
      .addScaledVector(sideways, -0.026);
    this.approach = queueEntrance(shop);
    const exitSide = shop.door
      .clone()
      .addScaledVector(this.outward, 0.15)
      .addScaledVector(sideways, 0.032);
    const spare = new Map<THREE.Vector3, Crosswalk>();
    this.exit = new SidewalkWalk(
      [this.head, exitSide, this.approach],
      spare,
      1
    );
    this.benchWalk = new SidewalkWalk(
      [this.head, exitSide, stop.approach, stop.seat],
      spare,
      1
    );
    this.fromBench = new SidewalkWalk(
      [stop.seat, stop.approach, this.approach],
      spare,
      1
    );
    this.clerk.dress(seller.id);
    this.clerk.position
      .copy(shop.door)
      .addScaledVector(this.outward, 0.083)
      .addScaledVector(sideways, -0.026);
    this.clerk.rotation.y = Math.atan2(this.outward.x, this.outward.z);
    this.stand.scale.setScalar(1 / METERS_PER_TILE);
    this.stand.position.copy(this.head).addScaledVector(this.outward, -0.02);
    this.stand.rotation.y = this.clerk.rotation.y;
    this.stand.visible = true;
    this.add(this.stand, this.clerk);
    const offset = (shop.x + shop.z) % 7;
    this.customers = guests.map(
      (guest, i) =>
        new Customer(
          guest,
          LUNCH.FIRST_ARRIVAL + offset + i * LUNCH.ARRIVAL_SPACING,
          i === 0
        )
    );
    this.add(...this.customers);
  }
  refresh(shop: StreetDoor, seller: Citizen, guests: Guest[]): boolean {
    if (
      this.seller !== seller ||
      !this.shop.door.equals(shop.door) ||
      !this.shop.curb.equals(shop.curb) ||
      !this.shop.stop!.seat.equals(shop.stop!.seat) ||
      !this.shop.stop!.approach.equals(shop.stop!.approach) ||
      this.shop.stop!.yaw !== shop.stop!.yaw
    )
      return false;
    for (const [i, g] of guests.entries()) {
      const old = this.customers[i].guest;
      if (old.person !== g.person) return false;
      if (old.route === g.route) continue;
      const points = old.route.path.points;
      if (
        points.length !== g.route.path.points.length ||
        points.some((p, j) => !p.equals(g.route.path.points[j]))
      )
        return false;
    }
    this.shop = shop;
    this.customers.forEach((c, i) => {
      c.guest.route = guests[i].route;
    });
    return true;
  }

  get serving() {
    return this.clerk.visible;
  }

  atHomeSince(id: string) {
    const c = this.customers.find(
      (c) => c.guest.person.id === id && !c.guest.person.workplace
    );
    if (!c) return;
    if (this.clock < c.arrival - c.guest.route.path.duration) return 0;
    return c.phase === 'away'
      ? this.departure(c) + c.guest.route.path.duration + c.outboundDelay
      : Infinity;
  }
  private departure(c: Customer) {
    return (
      c.orderEnd + LEAVE + (c.lunchOnBench ? LUNCH.MEAL_MINUTES + LEAVE : 0)
    );
  }
  update(
    now: number,
    reset: boolean,
    requested?: Set<Crosswalk>,
    occupied?: (c: Crosswalk) => boolean,
    approaching?: Set<Crosswalk>,
    onHandoff?: (at: THREE.Vector3) => void
  ) {
    // Just before midnight the interpolated street clock can reach 1440.
    if (now < this.clock - 60) reset = true;
    if (!reset) now = Math.max(now, this.clock);
    const before = reset ? now : this.clock;
    this.clock = now;
    for (const c of this.customers) {
      if (reset) c.inboundDelay = c.outboundDelay = 0;
      if (requested && occupied && approaching)
        c.inboundDelay = crossingDelay(
          c.guest.route.path,
          c.arrival - c.guest.route.path.duration,
          false,
          before,
          now,
          c.inboundDelay,
          requested,
          occupied,
          approaching
        );
    }
    const queue = [...this.customers].sort(
      (a, b) => a.arrival + a.inboundDelay - (b.arrival + b.inboundDelay)
    );
    let previousEnd = 0;
    this.clerk.visible = false;
    for (const [index, c] of queue.entries()) {
      const arrival = c.arrival + c.inboundDelay;
      const path = c.guest.route.path;
      c.orderStart = Math.max(arrival + JOIN, previousEnd + STEP);
      c.orderEnd = c.orderStart + LUNCH.SERVICE_MINUTES;
      previousEnd = c.orderEnd;
      const leave = this.departure(c);
      const previousDelay = c.outboundDelay;
      if (requested && occupied && approaching)
        c.outboundDelay = crossingDelay(
          path,
          leave,
          true,
          before,
          now,
          c.outboundDelay,
          requested,
          occupied,
          approaching
        );
      const face = Math.atan2(-this.outward.x, -this.outward.z);
      if (
        now < c.arrival - path.duration ||
        now >= leave + path.duration + c.outboundDelay
      )
        c.pose('away', now);
      else if (now < arrival) {
        const progress = clamp(1 + (now - arrival) / path.duration);
        path.place(c, path.length * progress, false, 0);
        c.pose(
          'approaching',
          now,
          now > before &&
            !(
              c.inboundDelay &&
              path.crossings.some(
                (x) => Math.abs(progress * path.length - x.from) < 0.00001
              )
            )
        );
      } else if (now < c.orderStart) {
        let places = 0,
          shuffling = now < arrival + JOIN;
        for (let j = 0; j < index; j++) {
          const rank = clamp((queue[j].orderEnd + STEP - now) / STEP);
          places += rank;
          if (rank > 0 && rank < 1) shuffling = true;
        }
        c.position
          .copy(this.head)
          .addScaledVector(this.outward, places * 0.036);
        c.position.lerp(this.approach, 1 - clamp((now - arrival) / JOIN));
        c.rotation.y = face;
        c.pose('queued', now, shuffling);
      } else if (now < c.orderEnd) {
        c.position.copy(this.head);
        c.rotation.y = face;
        c.pose('ordering', now);
        this.clerk.visible = true;
        this.clerk.serve(now, c.orderEnd, c.lunchOnBench);
      } else if (now < c.orderEnd + LEAVE) {
        if (!reset && c.phase === 'ordering') onHandoff?.(this.head);
        const leg = c.lunchOnBench ? this.benchWalk : this.exit;
        leg.place(c, leg.length * clamp((now - c.orderEnd) / LEAVE), false, 0);
        c.pose(c.lunchOnBench ? 'toBench' : 'takeaway', now, true);
      } else if (c.lunchOnBench && now < leave - LEAVE) {
        c.position.copy(this.shop.stop!.seat);
        c.rotation.y = this.shop.stop!.yaw;
        c.pose('eating', now);
      } else if (now < leave) {
        this.fromBench.place(
          c,
          this.fromBench.length * clamp(1 + (now - leave) / LEAVE),
          false,
          0
        );
        c.pose('returning', now, true);
      } else {
        const distance =
          path.length *
          (1 - clamp((now - leave - c.outboundDelay) / path.duration));
        path.place(c, distance, true, 0);
        c.pose(
          'returning',
          now,
          now > before && c.outboundDelay === previousDelay
        );
      }
    }
    this.stand.visible = shutterOpening(this.shop.x, this.shop.z, now) > 0.9;
    // The employee stays behind the counter between orders.
    if (
      !this.clerk.visible &&
      now >= queue[0].orderStart - JOIN &&
      now < previousEnd
    ) {
      this.clerk.visible = true;
      this.clerk.serve(now);
    }
  }
}

export class RetailLunch extends THREE.Group {
  private homes: StreetDoor[] = [];
  private routes = new Map<string, LunchRoute>();
  private counters = new Map<string, LunchCounter>();
  private footfall = new Map<StreetDoor, number>();
  private people = new Map<string, LunchCounter>();
  private staff = new Map<string, LunchCounter>();
  onHandoff?: (at: THREE.Vector3) => void;
  readonly seats = new Set<BenchStop>();
  setNetwork(homes: StreetDoor[], routes: LunchRoute[]) {
    this.homes = homes;
    this.routes = new Map(routes.map((r) => [key(r.origin), r]));
    this.footfall.clear();
    for (const { shop } of routes)
      this.footfall.set(shop, (this.footfall.get(shop) ?? 0) + 1);
  }
  updateResidents(
    city: ICity,
    minute: number,
    reset: boolean,
    available: (id: string) => boolean
  ) {
    const groups = new Map<StreetDoor, Guest[]>();
    const sellers = new Map<StreetDoor, Citizen>();
    for (const { shop } of this.routes.values()) {
      if (sellers.has(shop)) continue;
      const building = city.getTile(shop.x, shop.z)?.building;
      const seller =
        building &&
        'jobs' in building &&
        building.jobs.workers.find((c) => available(c.id));
      if (seller) sellers.set(shop, seller);
    }
    const working = new Set([...sellers.values()].map((c) => c.id));
    for (const home of this.homes) {
      const building = city.getTile(home.x, home.z)?.building;
      if (!building || !('residents' in building)) continue;
      for (const person of building.residents.all) {
        if (
          !available(person.id) ||
          working.has(person.id) ||
          person.age < CONFIG.CITIZEN.MIN_WORKING_AGE
        )
          continue;
        const job = person.workplace;
        const route = this.routes.get(job ? job.x + ',' + job.y : key(home));
        if (!route || !sellers.has(route.shop)) continue;
        let guests = groups.get(route.shop);
        if (!guests) {
          guests = [];
          groups.set(route.shop, guests);
        }
        guests.push({ person, route });
      }
    }
    const centers = [...groups.entries()]
      .filter(([, guests]) => guests.length >= 3)
      .sort(
        (a, b) =>
          this.footfall.get(b[0])! - this.footfall.get(a[0])! ||
          a[0].x - b[0].x ||
          a[0].z - b[0].z
      );
    const next = new Map<string, LunchCounter>();
    this.people.clear();
    this.staff.clear();
    this.seats.clear();
    for (const [shop, guests] of centers.slice(0, LUNCH.MAX_BUSY_SHOPS)) {
      guests.sort(
        (a, b) =>
          a.route.path.length - b.route.path.length ||
          a.person.id.localeCompare(b.person.id)
      );
      // Mix nearby households and workplaces before filling the remaining seats.
      const origins = new Set<StreetDoor>(),
        first: Guest[] = [],
        others: Guest[] = [];
      for (const guest of guests) {
        (origins.has(guest.route.origin) ? others : first).push(guest);
        origins.add(guest.route.origin);
      }
      const group = first.concat(others).slice(0, LUNCH.CUSTOMERS_PER_SHOP);
      const seller = sellers.get(shop)!;
      const signature = [
        key(shop),
        seller.id,
        ...group.map((g) => g.person.id),
      ].join('/');
      let counter = this.counters.get(signature);
      const fresh = !counter?.refresh(shop, seller, group);
      if (!counter || fresh) {
        counter?.removeFromParent();
        counter = new LunchCounter(shop, seller, group);
        this.add(counter);
      }
      if (fresh || reset) counter.update(minute, true);
      next.set(signature, counter);
      this.seats.add(shop.stop!);
      this.staff.set(seller.id, counter);
      for (const g of group) this.people.set(g.person.id, counter);
    }
    for (const [k, c] of this.counters) if (!next.has(k)) c.removeFromParent();
    this.counters = next;
  }
  has(id: string) {
    return this.people.has(id) || this.staff.has(id);
  }
  onBreak(id: string) {
    if (this.staff.get(id)?.serving) return true;
    return this.people
      .get(id)
      ?.customers.some((c) => c.guest.person.id === id && c.visible);
  }
  homeSince(id: string) {
    return this.people.get(id)?.atHomeSince(id);
  }
  advance(
    minute: number,
    requested: Set<Crosswalk>,
    occupied: (c: Crosswalk) => boolean,
    approaching: Set<Crosswalk>
  ) {
    for (const c of this.counters.values())
      c.update(minute, false, requested, occupied, approaching, this.onHandoff);
  }
  *soundSources(): Iterable<SidewalkSource> {
    for (const counter of this.counters.values()) {
      for (const customer of counter.customers) {
        const strength = lunchVoices[customer.phase];
        if (strength)
          yield { clip: 'lunch', point: customer.position, strength };
      }
    }
  }

  preview(near?: { x: number; y: number }) {
    const counters = [...this.counters.values()];
    if (near) {
      const distance = (c: LunchCounter) =>
        Math.hypot(c.shop.x - near.x, c.shop.z - near.y);
      counters.sort((a, b) => distance(a) - distance(b));
    }
    const counter = counters[0];
    if (!counter) return;
    const { door, curb, stop } = counter.shop;
    const point = door.clone().lerp(stop!.seat, 0.44);
    return {
      x: point.x,
      y: point.z,
      azimuth:
        (Math.atan2(curb.x - door.x, curb.z - door.z) * 180) / Math.PI + 65,
    };
  }
}
