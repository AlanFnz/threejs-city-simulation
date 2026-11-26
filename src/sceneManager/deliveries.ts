import * as THREE from 'three';
import { Vehicle } from '../city/vehicle';
import { VehicleGraph } from '../city/vehicle/vehicleGraph';
import { VehicleGraphNode } from '../city/vehicle/vehicleGraphNode';
import type { Crosswalk } from '../city/vehicle/crosswalk';
import CONFIG from '../config';
import { DeliveryWorker, DELIVERY_GAIT } from './deliveryWorker';
import {
  planDelivery,
  type DeliveryRoute,
  type FreightStops,
} from './deliveryRoute';
import type { StreetDoor } from './pedestrians';

function waypoint(point: THREE.Vector3): VehicleGraphNode {
  return new VehicleGraphNode(point.x, point.z);
}

export type DeliveryCue =
  'gateOpen' | 'gateClose' | 'parcel' | 'footLeft' | 'footRight';
type PlayDeliveryCue = (cue: DeliveryCue, position: THREE.Vector3) => void;

const DELIVERY_WALK_SPEED = 0.18;
const forward = new THREE.Vector3(1, 0, 0);
const panel = new THREE.BoxGeometry(0.102, 0.034, 0.002);
const stripe = new THREE.BoxGeometry(0.074, 0.006, 0.003);
const teal = new THREE.MeshLambertMaterial({ color: 0x206d70 });
const cream = new THREE.MeshLambertMaterial({ color: 0xffce73 });

class DeliveryTruck extends Vehicle {
  private shopStop: VehicleGraphNode;
  private itinerary: VehicleGraphNode[];
  private nextIndex = 0;
  private anchors: THREE.Group;
  private factoryStop: VehicleGraphNode;
  private worker = new DeliveryWorker();
  private unloading = 0;
  private tailgate: THREE.Vector3;
  private walkLength: number;
  private doors: (THREE.Object3D | undefined)[];

  constructor(
    graph: VehicleGraph,
    readonly route: DeliveryRoute,
    mesh: THREE.Mesh,
    private playCue?: PlayDeliveryCue
  ) {
    const factoryStop = waypoint(route.factory.park);
    const shopStop = waypoint(route.shop.park);
    const anchors = new THREE.Group();
    anchors.add(factoryStop, shopStop);
    graph.add(anchors);
    super(
      factoryStop,
      route.outbound[0],
      graph.assetManager,
      mesh,
      Infinity,
      'truck'
    );
    this.name = 'Delivery truck';
    this.shopStop = shopStop;
    this.itinerary = [
      ...route.outbound.slice(1),
      shopStop,
      ...route.inbound,
      factoryStop,
    ];
    this.factoryStop = factoryStop;
    this.anchors = anchors;
    anchors.add(this.worker);
    this.doors = ['truck-door_R', 'truck-door_L'].map((name) =>
      mesh.getObjectByName(name)
    );
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(panel, teal),
        mark = new THREE.Mesh(stripe, cream);
      board.position.set(-0.032, 0.067, side * 0.036);
      mark.position.set(-0.032, 0.067, side * 0.0375);
      this.add(board, mark);
    }
    this.tailgate = route.shop.park
      .clone()
      .addScaledVector(route.shop.heading, -0.116)
      .addScaledVector(
        new THREE.Vector3(-route.shop.heading.z, 0, route.shop.heading.x),
        0.04
      );
    this.tailgate.y = route.shop.frontage.curb.y;
    this.walkLength =
      this.tailgate.distanceTo(route.shop.frontage.curb) +
      route.shop.frontage.curb.distanceTo(route.shop.frontage.door);
  }

  get receiving() {
    // The shopkeeper also lifts the shutter for a late delivery. Only the
    // final approach and the pull-away belong to this stop.
    const shopIndex = this.route.outbound.length;
    if (this.nextIndex < shopIndex - 2 || this.nextIndex > shopIndex + 2)
      return;
    const distance = this.position.distanceTo(this.route.shop.park);
    if (distance >= 0.55) return;
    const { x, z } = this.route.shop.frontage;
    return {
      x,
      z,
      opening: 1 - THREE.MathUtils.smoothstep(distance, 0.08, 0.55),
    };
  }

  // The box body still occupies part of the lane when pulled over.
  protected get laneClearance(): number {
    return 0.072;
  }

  protected get stoppingAtDestination(): boolean {
    return (
      this.destination === this.shopStop ||
      this.destination === this.factoryStop
    );
  }

  protected nextNode(): VehicleGraphNode | null {
    return this.itinerary[this.nextIndex++] ?? null;
  }

  update(
    dt: number,
    crossings: ReadonlySet<Crosswalk>,
    traffic: readonly Vehicle[]
  ): void {
    if (this.arrived && this.destination === this.shopStop && this.unload(dt))
      return;
    super.update(dt, crossings, traffic);
  }

  private unload(dt: number): boolean {
    const { heading, frontage } = this.route.shop;
    this.heading.copy(heading);
    this.quaternion.setFromUnitVectors(forward, heading);
    const previous = this.unloading;
    if (previous === 0) this.playCue?.('gateOpen', this.tailgate);
    this.unloading += dt;
    const opening = 0.65,
      handoff = 0.65;
    const walkTime = this.walkLength / DELIVERY_WALK_SPEED;
    const t = this.unloading - opening;
    const end = walkTime * 2 + handoff;
    const open = THREE.MathUtils.clamp(
      Math.min(this.unloading, end + opening - t) / opening,
      0,
      1
    );
    this.doors.forEach((door, i) => {
      if (door) door.rotation.y = (i ? -1 : 1) * open * 1.8;
    });
    this.worker.visible = t >= 0 && t <= end;
    if (this.worker.visible) {
      const carrying = t < walkTime + handoff / 2;
      const distance = Math.min(t, walkTime, end - t) * DELIVERY_WALK_SPEED;
      this.worker.walk(
        this.tailgate,
        frontage.curb,
        frontage.door,
        distance,
        carrying
      );
    }
    const before = previous - opening;
    if (before < walkTime + handoff / 2 && t >= walkTime + handoff / 2)
      this.playCue?.('parcel', frontage.door);
    if (before < end + opening && t >= end + opening)
      this.playCue?.('gateClose', this.tailgate);
    if (
      this.worker.visible &&
      ((t >= 0 && t < walkTime) || t > walkTime + handoff)
    ) {
      // One pronounced footfall per gait cycle, on both legs of the walk.
      const stride = (time: number) =>
        Math.floor(
          (Math.max(0, Math.min(time, walkTime, end - time)) *
            DELIVERY_WALK_SPEED *
            DELIVERY_GAIT) /
            (2 * Math.PI)
        );
      if (stride(t) !== stride(before))
        this.playCue?.(
          stride(t) % 2 ? 'footLeft' : 'footRight',
          this.worker.position
        );
    }
    return t < end + opening;
  }

  dispose(): void {
    this.anchors.removeFromParent();
    super.dispose();
  }
}

function stillPresent(stops: StreetDoor[], original: StreetDoor): boolean {
  return stops.some(
    (stop) =>
      stop.x === original.x &&
      stop.z === original.z &&
      stop.door.equals(original.door) &&
      stop.curb.equals(original.curb)
  );
}

export class Deliveries {
  private stops: FreightStops = { factories: [], shops: [] };
  private truck?: DeliveryTruck;
  private round = 0;
  private ready?: DeliveryRoute;
  private planned = false;
  private delay = 0;

  constructor(
    private graph: VehicleGraph,
    private playCue?: PlayDeliveryCue
  ) {}

  updateStops(stops: FreightStops, restore: boolean): void {
    this.stops = stops;
    this.planned = false;
    this.ready = undefined;
    const route = this.truck?.route;
    if (
      restore ||
      (route &&
        (!stillPresent(stops.factories, route.factory.frontage) ||
          !stillPresent(stops.shops, route.shop.frontage) ||
          [...route.outbound, ...route.inbound].some((node) => !node.parent)))
    ) {
      this.truck?.dispose();
      this.truck = undefined;
      this.delay = 0;
    }
    if (restore) this.round = 0;
  }

  private nextRoute(): DeliveryRoute | undefined {
    if (!this.planned) {
      this.ready = planDelivery(this.graph, this.stops, this.round);
      this.planned = true;
    }
    return this.ready;
  }

  get receiving() {
    return this.truck?.parent ? this.truck.receiving : undefined;
  }

  previewLots(): { x: number; y: number }[] {
    const route = this.truck?.route ?? this.nextRoute();
    if (!route) return [];
    const points = route.outbound.map((node) =>
      node.getWorldPosition(new THREE.Vector3())
    );
    return [
      route.factory.frontage.door,
      ...points,
      route.shop.frontage.door,
    ].map((p) => ({ x: p.x, y: p.z }));
  }

  dispatch(
    dt: number,
    crossings: ReadonlySet<Crosswalk>,
    approaching: ReadonlySet<Crosswalk>
  ): void {
    if (this.truck?.parent) return;
    if (this.truck) {
      this.truck = undefined;
      this.delay = 4;
    }
    this.delay -= dt;
    if (this.delay > 0) return;
    const route = this.nextRoute();
    if (!route) return;
    const start = route.factory.park;
    if (
      this.graph.vehicles.children.some(
        (car) =>
          car.position.distanceToSquared(start) <
          CONFIG.VEHICLE.FOLLOWING_GAP ** 2
      ) ||
      [...crossings, ...approaching].some((crossing) =>
        crossing.occupiedBy(start)
      )
    )
      return;
    const mesh = this.graph.assetManager.createDeliveryTruckMesh();
    if (!mesh) return;
    this.truck = new DeliveryTruck(this.graph, route, mesh, this.playCue);
    this.graph.vehicles.add(this.truck);
    this.round++;
    this.planned = false;
  }
}
