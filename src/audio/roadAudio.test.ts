import { expect, it } from 'vitest';
import { OrthographicCamera } from 'three';
import type { Vehicle } from '../city/vehicle';
import { nearestCars } from './roadAudio';

it('keeps three nearby cars, excludes transit and freight, and fades to the overview', () => {
  const camera = new OrthographicCamera();
  const focus = { x: 10, y: 7 };
  const car = (id: number, dx: number, kind = 'car') =>
    ({ id, kind, position: { x: focus.x + dx, z: focus.y } }) as Vehicle;
  const traffic = [
    car(0, 8),
    car(1, 1),
    car(2, 0.5),
    car(3, 0.3),
    car(4, 0.31),
    car(5, 0, 'bus'),
    car(6, 0, 'truck'),
  ];
  const near = () => nearestCars(traffic, focus, camera, new Map());
  camera.zoom = 4;
  const close = near();
  expect(close.map((source) => source.car.id)).toEqual([3, 4, 2]);
  expect(close[0].pan).toBeGreaterThan(0);
  camera.zoom = 0.2;
  expect(near()[0].gain).toBeLessThan(close[0].gain / 3);
});
