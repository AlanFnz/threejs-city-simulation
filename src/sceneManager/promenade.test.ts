import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { ModelKey } from '../assetManager/constants';
import { SIDES } from '../assetManager/frontage';
import { promenadeRoute, type ShopFront } from './promenade';

function shop(x: number, z: number, facing: number): ShopFront {
  const dir = SIDES[facing];
  const point = (depth: number) =>
    new Vector3(x + dir.x * depth, 0.014, z + dir.y * depth);
  return {
    x,
    z,
    facing,
    door: point(0.2),
    curb: point(0.84),
    road: new Matrix4(),
    matrix: new Matrix4(),
    modelKey: ModelKey.COMMERCIAL_A1,
  };
}

describe('commercial promenade', () => {
  it('joins neighbouring shop entrances along any straight street', () => {
    SIDES.forEach((normal, facing) => {
      const a = shop(5, 5, facing),
        b = shop(5 + normal.y, 5 - normal.x, facing);
      const points = promenadeRoute(a, b, () => true);
      expect(points).toHaveLength(2);
      expect(points[0].distanceTo(points[1])).toBeCloseTo(1);
    });
  });

  it('follows the public corner around the Puerto Claro shops in either direction', () => {
    const a = shop(18, 15, 2),
      b = shop(19, 15, 1);
    const road = (x: number, z: number) => z === 14 && (x === 19 || x === 20);
    const points = promenadeRoute(a, b, road);
    expect(points).toHaveLength(3);
    expect(points[1].z).toBe(points[0].z);
    expect(points[1].x).toBe(points[2].x);
    expect(promenadeRoute(b, a, road)).toEqual([...points].reverse());
    expect(promenadeRoute(a, b, () => false)).toEqual([]);
  });

  it('leaves gaps, opposing entrances and back-to-back lots separate', () => {
    const a = shop(5, 5, 0);
    for (const other of [shop(7, 5, 0), shop(6, 5, 2), shop(5, 6, 0)]) {
      expect(promenadeRoute(a, other, () => true)).toEqual([]);
    }
  });
});
