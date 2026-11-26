import { Vector3 } from 'three';
import { VehicleGraphNode } from '../city/vehicle/vehicleGraphNode';
import type { VehicleGraph } from '../city/vehicle/vehicleGraph';
import type { StreetDoor } from './pedestrians';

export interface FreightStops {
  factories: StreetDoor[];
  shops: StreetDoor[];
}

export interface LoadingBay {
  frontage: StreetDoor;
  entry: VehicleGraphNode;
  exit: VehicleGraphNode;
  park: Vector3;
  heading: Vector3;
}

export interface DeliveryRoute {
  factory: LoadingBay;
  shop: LoadingBay;
  outbound: VehicleGraphNode[];
  inbound: VehicleGraphNode[];
}

// Pull over on the lane beside the entrance. Projecting onto its directed
// edge also supplies separate nodes for arriving at and leaving the curb.
export function loadingBay(
  graph: VehicleGraph,
  frontage: StreetDoor
): LoadingBay | undefined {
  const road = new Vector3().setFromMatrixPosition(frontage.road);
  const tile = graph.getTile(Math.round(road.x), Math.round(road.z));
  if (!tile) return;
  let best: LoadingBay | undefined;
  let nearest = Infinity;
  for (const entry of tile.children) {
    if (!(entry instanceof VehicleGraphNode)) continue;
    const a = entry.getWorldPosition(new Vector3());
    for (const exit of entry.next) {
      if (exit.parent !== tile) continue;
      const edge = exit.getWorldPosition(new Vector3()).sub(a);
      const length = edge.length();
      if (!length) continue;
      const heading = edge.divideScalar(length);
      const right = new Vector3(-heading.z, 0, heading.x);
      const offset = frontage.curb.clone().sub(a);
      if (right.dot(offset) <= 0) continue;
      const along = Math.max(
        0.1 * length,
        Math.min(0.9 * length, heading.dot(offset))
      );
      const lane = a.clone().addScaledVector(heading, along);
      const distance = lane.distanceToSquared(frontage.curb);
      if (distance >= nearest) continue;
      nearest = distance;
      best = {
        frontage,
        entry,
        exit,
        heading,
        park: lane.addScaledVector(
          right,
          Math.min(0.045, right.dot(offset) * 0.7)
        ),
      };
    }
  }
  return best;
}

export function lanePath(
  start: VehicleGraphNode,
  targets: Set<VehicleGraphNode>
): VehicleGraphNode[] | undefined {
  const queue = [start];
  const previous = new Map<VehicleGraphNode, VehicleGraphNode | null>([
    [start, null],
  ]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (targets.has(node)) {
      const path = [];
      for (let n: VehicleGraphNode | null = node; n; n = previous.get(n)!)
        path.push(n);
      return path.reverse();
    }
    for (const next of node.next) {
      if (!next.parent || previous.has(next)) continue;
      previous.set(next, node);
      queue.push(next);
    }
  }
}

export function planDelivery(
  graph: VehicleGraph,
  stops: FreightStops,
  round: number
): DeliveryRoute | undefined {
  if (!stops.factories.length || !stops.shops.length) return;
  const shops = stops.shops
    .map((shop) => loadingBay(graph, shop))
    .filter((bay): bay is LoadingBay => !!bay);
  for (let i = 0; i < stops.factories.length && shops.length; i++) {
    const factory = loadingBay(
      graph,
      stops.factories[(round + i) % stops.factories.length]
    );
    if (!factory) continue;
    const offset = Math.floor(round / stops.factories.length) % shops.length;
    const candidates = [
      ...shops.slice(offset),
      ...shops.slice(0, offset),
    ].filter(
      (shop) =>
        shop.entry !== factory.entry ||
        shop.park.distanceToSquared(factory.park) > 0.0001
    );
    if (!candidates.length) continue;
    // Start with the nearest reachable shop. Later rounds give other shops
    // a turn, falling back to the connected component of this factory.
    const preferred =
      round >= stops.factories.length && candidates[0]
        ? lanePath(factory.exit, new Set([candidates[0].entry]))
        : undefined;
    const outbound =
      preferred ??
      lanePath(factory.exit, new Set(candidates.map((shop) => shop.entry)));
    if (!outbound) continue;
    const shop = candidates.find(
      (stop) => stop.entry === outbound[outbound.length - 1]
    )!;
    const inbound = lanePath(shop.exit, new Set([factory.entry]));
    if (inbound) return { factory, shop, outbound, inbound };
  }
}
