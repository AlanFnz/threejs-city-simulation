import { Matrix4, Vector3, type Object3D } from 'three';
import { expect, it } from 'vitest';
import { City } from '../city';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { CommercialZone } from '../city/building/zones/commercialZone';
import { Citizen } from '../city/citizen';
import { CITIZEN_STATE } from '../city/citizen/constants';
import { Crosswalk } from '../city/vehicle/crosswalk';
import { SidewalkWalk } from './sidewalkWalk';
import { RetailLunch, queueEntrance } from './retailLunch';
import type { StreetDoor } from './pedestrians';
import CONFIG from '../config';

it('serves in arrival order, reserves one bench and keeps crossing delays through an unrelated street edit', () => {
  const city = new City(7);
  try {
    const z = 2,
      shopX = 3;
    const pt = (x: number, y: number) => new Vector3(x, 0.014, y);
    const shop: StreetDoor = {
      x: shopX,
      z,
      door: pt(shopX, z),
      curb: pt(shopX, z + 0.8),
      road: new Matrix4(),
      stop: {
        seat: pt(shopX + 0.09, z + 0.48),
        approach: pt(shopX, z + 0.48),
        yaw: 0,
      },
    };
    const store = new CommercialZone(shopX, z);
    city.getTile(shopX, z)!.building = store;
    const join = queueEntrance(shop);
    const a = pt(2.4, 2.8),
      b = pt(2.6, 2.8);
    const crossing = new Crosswalk(a, b);
    const crosswalks = new Map([
      [a, crossing],
      [b, crossing],
    ]);
    const routes = [0, 1, 2].map((i) => {
      const home = new ResidentialZone(i, 1);
      city.getTile(i, 1)!.building = home;
      const person = new Citizen(home, {
        id: 'buyer-' + i,
        firstName: 'Luz',
        surname: 'Sol',
        age: 68,
        state: CITIZEN_STATE.RETIRED,
      });
      home.residents.restore([person]);
      if (!i) {
        const staff = new Citizen(home, {
          id: 'seller',
          firstName: 'Eva',
          surname: 'Sol',
          age: 31,
          state: CITIZEN_STATE.EMPLOYED,
        });
        staff.setWorkplace(store);
        store.jobs.hire(staff);
        home.residents.restore([person, staff]);
      }
      const door = pt(2.3 - i * 0.6, 2.8);
      const origin = { x: i, z: 1, door, curb: door, road: new Matrix4() };
      const points = !i
        ? [door, a, b, shop.curb, join]
        : [door, shop.curb, join];
      return {
        origin,
        shop,
        path: new SidewalkWalk(
          points,
          crosswalks,
          CONFIG.LUNCH.WALK_MINUTES_PER_TILE
        ),
      };
    });
    const l = new RetailLunch(),
      homes = routes.map((r) => r.origin);
    l.setNetwork(homes, routes);
    l.updateResidents(city, 650, true, () => true);
    const counter = l.children[0],
      buyers = [0, 1, 2].map((i) => counter.getObjectByName('buyer-' + i)!);
    const seat = shop.stop!.seat,
      head = pt(2.974, 2.124);
    const there = (person: Object3D, point: Vector3) =>
      person.visible && person.position.distanceTo(point) < 0.001;
    const served: number[] = [],
      eaten = new Set<number>(),
      bags = new Set<number>();
    const handoffs: Vector3[] = [];
    l.onHandoff = (point) => handoffs.push(point.clone());
    let line = false,
      asked = false;
    for (let m = 650; m < 970; m += 0.5) {
      if (m === 730) {
        const rebuilt = { ...shop, door: shop.door.clone() };
        l.setNetwork(
          homes,
          routes.map((r) => ({ ...r, shop: rebuilt }))
        );
        l.updateResidents(city, m, false, () => true);
        expect(l.children[0]).toBe(counter);
      }
      const requests = new Set<Crosswalk>();
      l.advance(m, requests, () => m < 752, new Set());
      if (m < 752 && requests.has(crossing)) asked = true;
      const ordering = buyers
        .map((p, i) => (there(p, head) ? i : -1))
        .filter((i) => i >= 0);
      expect(ordering.length).toBeLessThanOrEqual(1);
      if (ordering.length && served[served.length - 1] !== ordering[0])
        served.push(ordering[0]);
      if (
        ordering.length &&
        buyers.some(
          (p) =>
            p.visible &&
            p.position.distanceTo(head) > 0.025 &&
            p.position.distanceTo(head) < 0.12
        )
      )
        line = true;
      for (const [i, p] of buyers.entries()) {
        if (there(p, seat) && p.getObjectByName('Sandwich')!.visible)
          eaten.add(i);
        if (p.visible && p.getObjectByName('Paper bag')!.visible) bags.add(i);
      }
    }
    expect(asked && line).toBe(true);
    expect(served).toEqual([1, 2, 0]);
    expect(handoffs).toHaveLength(3);
    expect(handoffs.every((p) => p.distanceTo(head) < 0.001)).toBe(true);
    expect([...eaten]).toEqual([0]);
    expect([...bags].sort()).toEqual([1, 2]);
    expect(buyers.every((p) => !p.visible)).toBe(true);
    l.updateResidents(city, 760, true, () => true);
    expect(there(buyers[0], seat)).toBe(true);
    expect(
      [...l.soundSources()].some(
        (source) => source.point === buyers[0].position
      )
    ).toBe(true);
    city.getTile(shopX, z)!.building = null;
    l.updateResidents(city, 760, false, () => true);
    expect(l.children.length).toBe(0);
    expect(l.seats.size).toBe(0);
    expect([...l.soundSources()]).toHaveLength(0);
  } finally {
    city.dispose();
  }
});
