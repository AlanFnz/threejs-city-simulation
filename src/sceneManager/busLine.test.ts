import { Matrix4, Vector3 } from 'three';
import { expect, it } from 'vitest';
import type { IAssetManager } from '../assetManager';
import { City } from '../city';
import { BUILDING_TYPE, ROAD_TYPE } from '../city/building/constants';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { IndustrialZone } from '../city/building/zones/industrialZone';
import { Citizen } from '../city/citizen';
import { CITIZEN_STATE } from '../city/citizen/constants';
import type { Vehicle } from '../city/vehicle';
import { VehicleGraph } from '../city/vehicle/vehicleGraph';
import { BusLine } from './busLine';

it('takes a worker from the west doors to the factory and home, and withdraws the bus when the road is cut', () => {
  const city = new City(12);
  try {
    const graph = new VehicleGraph(city, {} as IAssetManager);
    const road = (x: number) =>
      graph.updateTile(x, 4, {
        style: x === 1 || x === 9 ? ROAD_TYPE.END : ROAD_TYPE.STRAIGHT,
        rotation: { x: 0, y: x === 9 ? 270 : 90 },
      });
    for (let x = 1; x <= 9; x++) road(x);
    const stops = [2, 5, 8].map((x) => ({
      x,
      z: 5,
      road: new Matrix4().makeTranslation(x, 0, 4),
      door: new Vector3(x, 0.014, 4.74),
      curb: new Vector3(x, 0.014, 4.15),
    }));
    const types = [
      BUILDING_TYPE.RESIDENTIAL,
      BUILDING_TYPE.COMMERCIAL,
      BUILDING_TYPE.INDUSTRIAL,
    ];
    stops.forEach((s, i) => city.getTile(s.x, s.z)!.placeBuilding(types[i]));
    const home = city.getTile(2, 5)!.building as ResidentialZone;
    const job = city.getTile(8, 5)!.building as IndustrialZone;
    const worker = new Citizen(home, {
      id: 'bus-worker',
      firstName: 'Eva',
      surname: 'Sol',
      age: 32,
      state: CITIZEN_STATE.EMPLOYED,
    });
    worker.setWorkplace(job);
    home.residents.restore([worker]);
    const lots = stops.map((s) => ({ x: s.x, y: s.z }));
    const line = new BusLine(graph, lots, () => 480);
    const walks = new Map([[stops[0], [stops[0].door, stops[0].curb]]]);
    line.updateStops(stops, walks, true);
    line.updateResidents();
    const bus = graph.vehicles.children[0] as Vehicle;
    expect(bus).toBeDefined();
    const clear = new Set<never>();
    let boarded = false,
      atWork = false,
      returned = false;
    for (let step = 0; step < 5000 && !returned; step++) {
      bus.update(0.05, clear, []);
      const position = line.passengerPosition!;
      boarded ||= position === bus.position;
      atWork ||= boarded && position.distanceTo(stops[2].door) < 0.001;
      returned =
        atWork &&
        line.homeSince(worker.id) === 480 &&
        position.distanceTo(stops[0].door) < 0.001;
    }
    expect(returned).toBe(true);
    line.updateStops(stops, walks, false);
    expect(graph.vehicles.children[0]).toBe(bus);
    graph.updateTile(6, 4, null);
    line.updateStops(stops, walks, false);
    expect(bus.parent).toBeNull();
    expect(line.origin).toBeUndefined();
    road(6);
    line.updateStops(stops, walks, false);
    expect(line.origin).toBeDefined();
    city.getTile(2, 5)!.removeBuilding();
    line.updateStops(stops, walks, false);
    expect(graph.vehicles.children).toHaveLength(0);
  } finally {
    city.dispose();
  }
});
