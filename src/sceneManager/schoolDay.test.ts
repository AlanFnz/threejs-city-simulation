import { Matrix4, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { City } from '../city';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { Citizen } from '../city/citizen';
import { Crosswalk } from '../city/vehicle/crosswalk';
import { CITIZEN_STATE } from '../city/citizen/constants';
import { SchoolDay } from './schoolDay';

it('walks the household across a clear crossing, waits outside class and reunites at dismissal', () => {
  const city = new City(6);
  try {
    const home = new ResidentialZone(1, 1);
    city.getTile(1, 1)!.building = home;
    const resident = (id: string, age: number) =>
      new Citizen(home, {
        id,
        age,
        firstName: id,
        surname: 'Sol',
        state: age < 16 ? CITIZEN_STATE.SCHOOL : CITIZEN_STATE.RETIRED,
      });
    const adult = resident('Ana', 68),
      small = resident('Eva', 7),
      tall = resident('Juan', 13);
    home.residents.restore([adult, small, tall]);
    const front = (x: number, z: number) => ({
      x,
      z,
      door: new Vector3(x, 0.014, z + 0.206),
      curb: new Vector3(x, 0.014, z + 0.85),
      road: new Matrix4().makeTranslation(x, 0, z + 1),
    });
    const house = front(1, 1),
      school = front(3, 1);
    const a = new Vector3(1.75, 0.014, 1.85),
      b = new Vector3(2.03, 0.014, 1.85);
    const crossing = new Crosswalk(a, b);
    const day = new SchoolDay();
    day.setRoutes(
      [
        {
          home: house,
          school,
          points: [house.door, house.curb, a, b, school.curb],
        },
      ],
      new Map([
        [a, crossing],
        [b, crossing],
      ]),
      () => undefined
    );
    day.updateResidents(city, 401, true);
    const family = day.children[0];
    const [guardian, first, second] = family.children;
    expect(first.scale.y).toBeLessThan(second.scale.y);
    const requests = new Set<Crosswalk>(),
      approach = new Set<Crosswalk>();
    for (let m = 402; m < 457; m += 0.25)
      day.advance(m, requests, () => true, approach);
    expect(requests.has(crossing)).toBe(true);
    expect(guardian.position.x).toBeCloseTo(a.x);
    expect(first.visible && second.visible).toBe(true);
    const waiting = guardian.position.clone();
    day.advance(457, requests, () => true, approach);
    expect(guardian.position).toEqual(waiting);
    for (let m = 458; m < 700; m++)
      day.advance(m, requests, () => false, approach);
    expect(family.children.every((f) => !f.visible)).toBe(true);
    expect(day.homeSince(small.id)).toBe(Infinity);
    expect(day.homeSince(adult.id)).toBeLessThan(700);
    day.updateResidents(city, 948, true);
    expect(guardian.visible).toBe(true);
    expect(first.visible).toBe(false);
    const gate = guardian.position.clone();
    day.advance(965, requests, () => false, approach);
    expect(guardian.position).toEqual(gate);
    expect(first.visible && second.visible).toBe(true);
    day.updateResidents(city, 992, true);
    expect(first.position.distanceTo(guardian.position)).toBeLessThan(0.07);
    day.updateResidents(city, 1100, true);
    expect(day.homeSince(small.id)).toBeLessThan(1100);
    expect(family.visible).toBe(false);
    day.updateResidents(city, 948, true, (id) =>
      id === adult.id ? Infinity : undefined
    );
    expect(day.children).toHaveLength(0);
    day.setRoutes([], new Map(), () => undefined);
    day.updateResidents(city, 948, false);
    expect(day.has(small.id)).toBe(false);
  } finally {
    city.dispose();
  }
});
