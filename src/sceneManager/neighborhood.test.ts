import { Matrix4, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { City } from '../city';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { Citizen } from '../city/citizen';
import { CITIZEN_STATE } from '../city/citizen/constants';
import { householdLights } from './householdLights';
import { GardenConversations } from './gardenConversations';
import { ModelKey } from '../assetManager/constants';
import { ShopShutters, shutterOpening } from './shopShutters';

it('opens adjacent shops at distinct times, then rolls the shutters back down', () => {
  const sample = (x: number, m: number) => shutterOpening(x, 19, m);
  expect(sample(22, 7 * 60)).toBe(0);
  const morning = Array.from({ length: 100 }, (_, i) => 7.5 * 60 + i);
  expect(
    morning.some(
      (m) =>
        sample(22, m) > 0 &&
        sample(22, m) < 1 &&
        sample(23, m) !== sample(22, m)
    )
  ).toBe(true);
  expect(sample(22, 12 * 60)).toBe(1);
  expect(sample(22, 22 * 60)).toBe(0);
});

it('waits for both residents before their garden visit and for each arrival before lighting their rooms', () => {
  const city = new City(4);
  try {
    const homes = [1, 2].map((x) => {
      const home = new ResidentialZone(x, 1);
      city.getTile(x, 1)!.building = home;
      const citizen = new Citizen(home, {
        id: 'test' + x,
        firstName: 'Alma',
        surname: 'Costa',
        age: 30,
        state: CITIZEN_STATE.EMPLOYED,
      });
      home.residents.restore([citizen]);
      return {
        x,
        z: 1,
        road: new Matrix4(),
        facing: 0,
        matrix: new Matrix4().makeTranslation(x, 0, 1),
        door: new Vector3(x, 0.014, 1.2),
        curb: new Vector3(x, 0.014, 1.8),
        citizen,
      };
    });
    const talk = new GardenConversations();
    talk.rebuild(homes);
    let second = Infinity;
    const since = (person: Citizen) =>
      person === homes[0].citizen ? 18 * 60 : second;
    const residents = homes.map((h) => h.citizen);
    expect(householdLights(residents, 17 * 60, since)).toBe(0);
    expect(householdLights(residents, 19 * 60, since)).toBe(0.5);
    talk.schedule(city, since);
    talk.update(19 * 60);
    expect(talk.children.some((p) => p.visible)).toBe(false);

    second = 19 * 60;
    talk.schedule(city, since);
    talk.update(second + 10);
    expect([...talk.soundSources()]).toHaveLength(0);
    talk.update(second + 30);
    expect([...talk.soundSources()]).toHaveLength(1);
    const [a, b] = talk.children;
    expect(a.visible && b.visible).toBe(true);
    expect(a.position.distanceTo(b.position)).toBeCloseTo(0.048);
    expect(
      a.getWorldDirection(new Vector3()).dot(b.getWorldDirection(new Vector3()))
    ).toBeCloseTo(-1);
    expect(householdLights(residents, second + 40, since)).toBe(1);
    expect(householdLights([], second + 40, since)).toBe(0);
    talk.update(23 * 60);
    expect([...talk.soundSources()]).toHaveLength(0);
    expect(talk.children.some((p) => p.visible)).toBe(false);
    talk.rebuild(homes.slice(1));
    expect(talk.children).toHaveLength(0);
  } finally {
    city.dispose();
  }
});

it('sounds a shutter only while it moves, including an after-hours delivery', () => {
  const shutters = new ShopShutters(2);
  const shop = {
    x: 0,
    z: 0,
    door: new Vector3(),
    curb: new Vector3(),
    road: new Matrix4(),
    facing: 0,
    matrix: new Matrix4(),
    modelKey: ModelKey.COMMERCIAL_A1,
  };
  shutters.rebuild([shop]);
  shutters.update(23 * 60);
  expect([...shutters.soundSources()]).toHaveLength(0);
  shutters.update(23 * 60, { x: 0, z: 0, opening: 0.5 });
  expect([...shutters.soundSources()]).toHaveLength(1);
  shutters.update(23 * 60, { x: 0, z: 0, opening: 0.5 });
  expect([...shutters.soundSources()]).toHaveLength(0);
  shutters.update(23 * 60);
  expect([...shutters.soundSources()]).toHaveLength(1);
  shutters.rebuild([]);
  expect([...shutters.soundSources()]).toHaveLength(0);
});
