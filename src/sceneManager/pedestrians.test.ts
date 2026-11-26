import { Matrix4, Triangle, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { ModelKey } from '../assetManager/constants';
import { City } from '../city';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { CommercialZone } from '../city/building/zones/commercialZone';
import { Citizen } from '../city/citizen';
import { CITIZEN_STATE } from '../city/citizen/constants';
import { Footpaths, Pedestrians, type StreetDoor } from './pedestrians';

it('restores the morning commute, lunch visit and evening return using the city clock', () => {
  const city = new City(4);
  try {
    const home = new ResidentialZone(0, 0);
    const store = new CommercialZone(1, 0);
    city.getTile(0, 0)!.building = home;
    city.getTile(1, 0)!.building = store;
    const worker = new Citizen(home, {
      id: 'worker',
      firstName: 'Eva',
      surname: 'Sol',
      age: 32,
      state: CITIZEN_STATE.EMPLOYED,
    });
    worker.setWorkplace(store);
    const shopper = new Citizen(home, {
      id: 'shopper',
      firstName: 'Luz',
      surname: 'Sol',
      age: 68,
      state: CITIZEN_STATE.RETIRED,
    });
    home.residents.restore([worker, shopper]);

    const path = new Footpaths();
    const road = new Matrix4();
    const pt = (x: number, z: number) => new Vector3(x, 0.018, z);
    path.addRoad(road, ModelKey.ROAD_STRAIGHT, [
      new Triangle(pt(-1, 0), pt(2, 0), pt(0, 1)),
    ]);
    const house: StreetDoor = {
      x: 0,
      z: 0,
      door: pt(0, -0.5),
      curb: pt(0, 0),
      road,
    };
    const shop: StreetDoor = {
      x: 1,
      z: 0,
      door: pt(1, -0.5),
      curb: pt(1, 0),
      road,
      stop: { approach: pt(1, -0.2), seat: pt(1.1, -0.2), yaw: 0 },
    };
    const people = new Pedestrians();
    people.setNetwork(path, [house], [shop], [shop]);
    people.updateResidents(city, 0);
    const [commuter, customer] = people.children;
    const commute: number[] = [],
      errands: number[] = [];
    for (let minute = 0; minute < 1440; minute += 5) {
      people.updateResidents(city, minute, true);
      if (commuter.visible) commute.push(minute);
      if (customer.visible) errands.push(minute);
    }
    expect(commute.some((m) => m < 11 * 60)).toBe(true);
    expect(commute.some((m) => m >= 17 * 60)).toBe(true);
    expect(
      commute.every(
        (m) => m >= 7 * 60 && (m < 11 * 60 || m >= 17 * 60) && m < 22 * 60
      )
    ).toBe(true);
    expect(errands.length).toBeGreaterThan(1);
    expect(errands.every((m) => m > 10 * 60 && m < 18 * 60)).toBe(true);

    people.updateResidents(city, commute[0], true);
    const before = commuter.position.clone();
    people.advance(0, () => false);
    expect(commuter.position).toEqual(before);
    people.setNetwork(path, [house], [], []);
    people.updateResidents(city, commute[0]);
    expect(people.children.every((p) => !p.visible)).toBe(true);
  } finally {
    city.dispose();
  }
});
