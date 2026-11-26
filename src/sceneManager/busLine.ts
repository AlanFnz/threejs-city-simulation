import * as THREE from 'three';
import CONFIG from '../config';
import { BUILDING_TYPE } from '../city/building/constants';
import type { Citizen } from '../city/citizen';
import { Vehicle } from '../city/vehicle';
import type { Crosswalk } from '../city/vehicle/crosswalk';
import { VehicleGraphNode } from '../city/vehicle/vehicleGraphNode';
import type { VehicleGraph } from '../city/vehicle/vehicleGraph';
import { lanePath, loadingBay, type LoadingBay } from './deliveryRoute';
import type { StreetDoor } from './pedestrians';
import { ResidentFigure } from './residentFigure';
import { BusModel, busStopMarker } from './busModel';
import { METERS_PER_TILE } from '../assetManager/worldScale';

type Lot = { x: number; y: number };
type Phase =
  | 'inside'
  | 'approaching'
  | 'waiting'
  | 'boarding'
  | 'onboard'
  | 'alighting'
  | 'leaving';
const forward = new THREE.Vector3(1, 0, 0);

class Platform {
  readonly anchor: VehicleGraphNode;
  readonly entrance: THREE.Vector3;
  readonly pole = busStopMarker();
  private sidewalk: THREE.Vector3;
  constructor(readonly bay: LoadingBay) {
    const { park, heading, frontage } = bay;
    this.sidewalk = frontage.curb.clone();
    this.anchor = new VehicleGraphNode(park.x, park.z);
    const right = new THREE.Vector3(-heading.z, 0, heading.x);
    this.entrance = park
      .clone()
      .addScaledVector(heading, 2.95 / METERS_PER_TILE)
      .addScaledVector(right, 1.25 / METERS_PER_TILE);
    this.entrance.y = frontage.curb.y;
    this.pole.position.copy(frontage.curb).addScaledVector(heading, 0.14);
    this.pole.quaternion.setFromUnitVectors(forward, heading);
  }
  queue(place: number) {
    return this.sidewalk
      .clone()
      .addScaledVector(this.bay.heading, 0.06 - place * 0.027);
  }
}

class Rider extends ResidentFigure {
  phase: Phase = 'inside';
  at = 0;
  homeArrival = 0;
  private wait: number;
  private stride = 0;
  private path: THREE.Vector3[] = [];
  constructor(
    readonly residentId: string,
    readonly destination: number,
    readonly place: number,
    public access: THREE.Vector3[]
  ) {
    super();
    this.dress(residentId);
    this.visible = false;
    this.wait = place * 0.45;
  }
  private walk(phase: Phase, ...points: THREE.Vector3[]) {
    this.phase = phase;
    this.path = points;
    this.visible = true;
  }
  advance(dt: number, platforms: Platform[], open: number, minute: number) {
    const stop = platforms[this.at],
      front = stop.bay.frontage;
    const destination = this.at === 0 ? this.destination : 0;
    if (this.phase === 'inside') {
      this.wait -= dt;
      if (this.wait > 0 || (!this.at && (minute < 6 * 60 || minute > 20 * 60)))
        return;
      const path = this.at === 0 ? this.access : [front.door, front.curb];
      this.position.copy(path[0]);
      this.homeArrival = Infinity;
      this.walk('approaching', ...path.slice(1), stop.queue(this.place));
    } else if (this.phase === 'waiting' && open === this.at) {
      this.walk('boarding', stop.entrance);
    } else if (this.phase === 'onboard' && open === destination) {
      this.at = destination;
      const arrival = platforms[destination];
      this.position.copy(arrival.entrance);
      this.walk('alighting', arrival.queue(this.place));
    }
    let distance = dt * CONFIG.TRANSIT.WALK_SPEED;
    while (this.path.length && distance > 0) {
      const target = this.path[0],
        remaining = this.position.distanceTo(target);
      const step = Math.min(remaining, distance);
      if (remaining > 0.00001) {
        this.rotation.y = Math.atan2(
          target.x - this.position.x,
          target.z - this.position.z
        );
        this.position.lerp(target, step / remaining);
      }
      this.stride += step * 95;
      distance -= step;
      if (step < remaining) break;
      this.path.shift();
    }
    if (!this.path.length) {
      if (this.phase === 'approaching') {
        this.phase = 'waiting';
        this.rotation.y = Math.atan2(
          stop.entrance.x - this.position.x,
          stop.entrance.z - this.position.z
        );
      } else if (this.phase === 'boarding') {
        this.phase = 'onboard';
        this.visible = false;
      } else if (this.phase === 'alighting') {
        const arrival = platforms[this.at].bay.frontage;
        this.walk(
          'leaving',
          ...(this.at === 0
            ? this.access.slice().reverse()
            : [arrival.curb, arrival.door])
        );
      } else if (this.phase === 'leaving') {
        this.phase = 'inside';
        this.visible = false;
        this.wait = CONFIG.TRANSIT.VISIT_SECONDS;
        if (!this.at) this.homeArrival = minute;
      }
    }
    if (this.visible) this.gait(this.stride, !!this.path.length);
  }
}

class CityBus extends Vehicle {
  private next = 0;
  private dwell = 0;
  private readonly itinerary: VehicleGraphNode[];
  private readonly model: BusModel;
  constructor(
    graph: VehicleGraph,
    readonly platforms: Platform[],
    legs: VehicleGraphNode[][],
    readonly riders: Rider[],
    private minute: () => number
  ) {
    const itinerary: VehicleGraphNode[] = [];
    legs.forEach((leg, i) =>
      itinerary.push(...leg, platforms[(i + 1) % platforms.length].anchor)
    );
    // Start on the inbound lane so neighbors can gather before the first service.
    const west = platforms[0].bay.park;
    let start = itinerary.length - 2;
    while (
      start > 0 &&
      itinerary[start].getWorldPosition(new THREE.Vector3()).distanceTo(west) <
        2.1
    )
      start--;
    const model = new BusModel();
    super(
      itinerary[start],
      itinerary[start + 1],
      graph.assetManager,
      model,
      Infinity,
      'bus'
    );
    this.model = model;
    this.model.openDoors(0);
    this.name = 'Línea 1';
    this.itinerary = itinerary;
    this.next = (start + 2) % itinerary.length;
  }
  get doorPhase() {
    if (this.dwell === 0) return 'moving';
    return this.dwell < CONFIG.TRANSIT.STOP_SECONDS - 0.35 ? 'open' : 'closing';
  }
  private face(stop: Platform) {
    this.heading.copy(stop.bay.heading);
    this.quaternion.setFromUnitVectors(forward, this.heading);
  }
  protected get stoppingAtDestination() {
    return this.platforms.some((p) => p.anchor === this.destination);
  }
  get overhang() {
    return (8 - 4.72) / 2 / METERS_PER_TILE;
  }
  protected get laneClearance() {
    return 0.075;
  }
  protected nextNode() {
    const node = this.itinerary[this.next];
    this.next = (this.next + 1) % this.itinerary.length;
    return node;
  }
  update(
    dt: number,
    crossings: ReadonlySet<Crosswalk>,
    traffic: readonly Vehicle[]
  ) {
    const index = this.arrived
      ? this.platforms.findIndex((p) => p.anchor === this.destination)
      : -1;
    const open =
      index >= 0 &&
      this.dwell >= 0.35 &&
      this.dwell < CONFIG.TRANSIT.STOP_SECONDS - 0.35;
    const exchanging = this.riders.some(
      (r) => r.phase === 'alighting' || r.phase === 'boarding'
    );
    // Release a single person through the curbside door, letting passengers off first.
    const next =
      open && !exchanging
        ? (this.riders.find(
            (r) =>
              r.phase === 'onboard' &&
              (r.at === 0 ? r.destination : 0) === index
          ) ?? this.riders.find((r) => r.phase === 'waiting' && r.at === index))
        : undefined;
    for (const rider of this.riders)
      rider.advance(
        dt,
        this.platforms,
        rider === next ? index : -1,
        this.minute()
      );
    this.model.showPassengers(
      this.riders.filter((r) => r.phase === 'onboard').length
    );
    if (index >= 0) {
      this.face(this.platforms[index]);
      this.dwell += dt;
      const exchanging = this.riders.some(
        (r) => r.phase === 'alighting' || r.phase === 'boarding'
      );
      const remaining = CONFIG.TRANSIT.STOP_SECONDS - this.dwell;
      if (exchanging && remaining < 0.5)
        this.dwell = CONFIG.TRANSIT.STOP_SECONDS - 0.5;
      this.model.openDoors(
        THREE.MathUtils.clamp(
          Math.min(this.dwell, CONFIG.TRANSIT.STOP_SECONDS - this.dwell) / 0.35,
          0,
          1
        )
      );
      if (this.dwell < CONFIG.TRANSIT.STOP_SECONDS) return;
      this.dwell = 0;
    }
    super.update(dt, crossings, traffic);
  }
}

export class BusLine {
  private bus?: CityBus;
  private scene = new THREE.Group();
  private legs: VehicleGraphNode[][] = [];
  private walks = new Map<StreetDoor, THREE.Vector3[]>();
  constructor(
    private graph: VehicleGraph,
    private lots: readonly Lot[],
    private minute: () => number
  ) {
    graph.add(this.scene);
  }
  get soundSource() { return this.bus?.parent ? this.bus : undefined; }
  get origin(): Lot | undefined {
    const point = this.bus?.platforms[0].bay.frontage.curb;
    return point && { x: point.x, y: point.z };
  }
  get passengerPosition(): THREE.Vector3 | undefined {
    if (!this.bus) return;
    const worker =
      this.bus.riders.find((r) => r.destination === 2) ?? this.bus.riders[0];
    if (!worker) return this.bus.position;
    if (worker.phase === 'onboard') return this.bus.position;
    if (worker.phase === 'inside')
      return worker.at === 0
        ? worker.access[0]
        : this.bus.platforms[worker.at].bay.frontage.door;
    return worker.position;
  }

  readonly homeSince = (id: string) =>
    this.bus?.riders.find((r) => r.residentId === id)?.homeArrival;

  updateStops(
    stops: StreetDoor[],
    walks: Map<StreetDoor, THREE.Vector3[]>,
    restore: boolean
  ) {
    this.walks = walks;
    if (this.lots.length !== 3) return;
    const types = [
      BUILDING_TYPE.RESIDENTIAL,
      BUILDING_TYPE.COMMERCIAL,
      BUILDING_TYPE.INDUSTRIAL,
    ];
    const fronts = this.lots.map(({ x, y }, i) =>
      this.graph.city.getTile(x, y)?.building?.type === types[i]
        ? stops.find((f) => f.x === x && f.z === y)
        : undefined
    );
    if (
      !restore &&
      this.bus?.parent &&
      this.bus.platforms.every(
        (p, i) =>
          fronts[i]?.road.equals(p.bay.frontage.road) &&
          p.bay.entry.next.includes(p.bay.exit)
      ) &&
      this.legs.every((leg) =>
        leg.every((n, i) => n.parent && (!i || leg[i - 1].next.includes(n)))
      )
    ) {
      this.bus.platforms.forEach((p, i) => {
        p.bay.frontage = fronts[i]!;
      });
      return;
    }
    this.bus?.dispose();
    this.bus = undefined;
    this.scene.clear();
    this.legs = [];
    const bays: LoadingBay[] = [];
    for (const f of fronts) {
      const bay = f && loadingBay(this.graph, f);
      if (!bay) return;
      bays.push(bay);
    }
    const legs: VehicleGraphNode[][] = [];
    for (let i = 0; i < 3; i++) {
      const leg = lanePath(bays[i].exit, new Set([bays[(i + 1) % 3].entry]));
      if (!leg) return;
      legs.push(leg);
    }
    const platforms = bays.map((b) => new Platform(b));
    for (const p of platforms) this.scene.add(p.anchor, p.pole);
    this.legs = legs;
    this.bus = new CityBus(this.graph, platforms, legs, [], this.minute);
    this.graph.vehicles.add(this.bus);
  }

  updateResidents() {
    if (!this.bus) return;
    const candidates = new Map<Citizen, THREE.Vector3[]>();
    for (const [home, path] of this.walks) {
      const building = this.graph.city.getTile(home.x, home.z)?.building;
      if (!building || !('residents' in building)) continue;
      for (const resident of building.residents.all) {
        if (resident.age >= CONFIG.CITIZEN.MIN_WORKING_AGE)
          candidates.set(resident, path);
      }
    }
    const destination = (c: Citizen) => {
      const job = c.workplace;
      if (!job) return 1;
      return this.lots.findIndex((l) => l.x === job.x && l.y === job.y);
    };
    const riders = this.bus.riders;
    const keep = new Set<Rider>();
    for (const [person, access] of candidates) {
      const stop = destination(person);
      if (stop <= 0) continue;
      let rider = riders.find(
        (r) => r.residentId === person.id && r.destination === stop
      );
      if (!rider) {
        const occupied = new Set(riders.map((r) => r.place));
        let place = 0;
        while (occupied.has(place)) place++;
        rider = new Rider(person.id, stop, place, access);
        this.scene.add(rider);
        riders.push(rider);
      }
      rider.access = access;
      keep.add(rider);
    }
    for (let i = riders.length - 1; i >= 0; i--) {
      if (keep.has(riders[i])) continue;
      riders[i].removeFromParent();
      riders.splice(i, 1);
    }
  }
}
