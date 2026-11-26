import { expect, it } from 'vitest';
import { City } from '../city';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { vehiclePerspective, neighborhoodMix } from './perspective';

it.each([48, 64])(
  'places the shore at the edge of a %i-tile map and blends the occupied block into night',
  (size) => {
    const city = new City(size);
    try {
      const mid = size / 2;
      const mix = (x: number, dark = 0, zoom = 5) =>
        neighborhoodMix(city, x, mid, zoom, dark);
      const empty = mix(mid);
      expect(mix(size - 1).shore).toBeGreaterThan(empty.shore);
      expect(mix(-2).shore).toBeGreaterThan(0);
      city.getTile(mid, mid)!.building = new ResidentialZone(mid, mid);
      const occupied = mix(mid);
      expect(occupied.street).toBeGreaterThan(empty.street);
      expect(mix(mid, 1).night).toBeGreaterThan(occupied.night);
      expect(mix(mid, 1).street).toBeLessThan(occupied.street);
      expect(mix(mid, 0, 0.2).cutoff).toBeLessThan(occupied.cutoff);
    } finally {
      city.dispose();
    }
  }
);

it('pans a nearby bus with the camera and attenuates at altitude or outside its street', () => {
  const right = vehiclePerspective(1, 0, 4, 1, 0);
  expect(vehiclePerspective(1, 0, 4, -1, 0).pan).toBe(-right.pan);
  expect(vehiclePerspective(1, 0, 0.2, 1, 0).gain).toBeLessThan(right.gain);
  expect(vehiclePerspective(11, 0, 4, 1, 0).gain).toBe(0);
});
