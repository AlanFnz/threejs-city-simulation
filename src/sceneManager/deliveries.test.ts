import { afterEach, beforeEach, expect, it } from 'vitest';
import { Matrix4, Mesh, Vector3 } from 'three';
import { City } from '../city';
import { ROAD_TYPE } from '../city/building/constants';
import { VehicleGraph } from '../city/vehicle/vehicleGraph';
import type { IAssetManager } from '../assetManager';
import { Deliveries, type DeliveryCue } from './deliveries';
import { DeliveryWorker } from './deliveryWorker';
import { planDelivery } from './deliveryRoute';

let city: City;
beforeEach(() => {
  city = new City(12);
});
afterEach(() => city.dispose());
function street() {
  const graph = new VehicleGraph(city, {
    createDeliveryTruckMesh: () => new Mesh(),
  } as IAssetManager);
  for (let x = 1; x <= 9; x++)
    graph.updateTile(x, 4, {
      style: x === 1 || x === 9 ? ROAD_TYPE.END : ROAD_TYPE.STRAIGHT,
      rotation: { x: 0, y: x === 9 ? 270 : 90 },
    });
  const frontage = (x: number) => ({
    x,
    z: 5,
    road: new Matrix4().makeTranslation(x, 0, 4),
    curb: new Vector3(x, 0.014, 4.15),
    door: new Vector3(x, 0.014, 4.74),
  });
  const stops = { factories: [frontage(2)], shops: [frontage(8)] };
  const cues: { name: DeliveryCue; position: Vector3 }[] = [];
  const service = new Deliveries(graph, (name, point) =>
    cues.push({ name, position: point.clone() })
  );
  service.updateStops(stops, false);
  return { service, graph, stops, cues };
}

it('drives a connected round trip beyond the ambient car lifetime and carries the parcel to the entrance', () => {
  const { service, graph, stops, cues } = street();
  const route = planDelivery(graph, stops, 0)!;
  for (const leg of [route.outbound, route.inbound]) {
    for (let i = 1; i < leg.length; i++)
      expect(leg[i - 1].next).toContain(leg[i]);
  }
  const empty = new Set<never>();
  service.dispatch(0.05, empty, empty);
  const [truck] = graph.vehicles.children;
  let worker: DeliveryWorker | undefined;
  graph.traverse((part) => {
    if (part instanceof DeliveryWorker) worker = part;
  });
  expect(worker).toBeDefined();
  let doorstep = false,
    leftShop = false;
  for (let i = 0; i < 3000 && truck.parent; i++) {
    graph.updateVehicles(0.05, empty, empty);
    if (worker!.visible) {
      expect(truck.position.distanceTo(route.shop.park)).toBeLessThan(0.001);
      if (worker!.position.distanceTo(stops.shops[0].door) < 0.002)
        doorstep = true;
    }
    if (doorstep && truck.position.distanceTo(route.shop.park) > 0.6)
      leftShop = true;
  }
  const names = cues.map((cue) => cue.name);
  expect(names.filter((name) => !name.startsWith('foot'))).toEqual([
    'gateOpen',
    'parcel',
    'gateClose',
  ]);
  const drop = names.indexOf('parcel');
  expect(names.slice(1, drop)).toContain('footLeft');
  expect(names.slice(drop + 1)).toContain('footRight');
  expect(cues[drop].position.distanceTo(stops.shops[0].door)).toBeLessThan(
    0.001
  );
  expect(doorstep && leftShop).toBe(true);
  expect(truck.parent).toBeNull();
  expect(truck.position.distanceTo(route.factory.park)).toBeLessThan(0.001);
  expect(worker!.parent?.parent).toBeNull();
});

it('cancels when a road is cut and dispatches again after reconnection', () => {
  const { service, graph, stops } = street();
  const empty = new Set<never>();
  service.dispatch(0.05, empty, empty);
  expect(graph.vehicles.children).toHaveLength(1);
  graph.updateTile(5, 4, null);
  service.updateStops(stops, false);
  expect(graph.vehicles.children).toHaveLength(0);
  expect(service.previewLots()).toEqual([]);
  service.dispatch(10, empty, empty);
  expect(graph.vehicles.children).toHaveLength(0);
  graph.updateTile(5, 4, {
    style: ROAD_TYPE.STRAIGHT,
    rotation: { x: 0, y: 90 },
  });
  service.updateStops(stops, false);
  service.dispatch(0.05, empty, empty);
  expect(graph.vehicles.children).toHaveLength(1);
  service.updateStops({ ...stops, shops: [] }, false);
  expect(graph.vehicles.children).toHaveLength(0);
});
