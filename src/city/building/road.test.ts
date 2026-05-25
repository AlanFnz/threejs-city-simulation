import { describe, it, expect } from 'vitest';
import { Road } from './road';
import { BUILDING_TYPE, ROAD_TYPE } from './constants';
import { ICity } from '..';

function cityWithRoadNeighbors(
  top: boolean,
  bottom: boolean,
  left: boolean,
  right: boolean
): ICity {
  const roads = new Set<string>();
  if (top) roads.add('1,0');
  if (bottom) roads.add('1,2');
  if (left) roads.add('0,1');
  if (right) roads.add('2,1');

  return {
    getTile: (x: number, y: number) => ({
      building: roads.has(`${x},${y}`) ? { type: BUILDING_TYPE.ROAD } : null,
    }),
  } as unknown as ICity;
}

describe('Road.simulate neighbor-to-style mapping', () => {
  const cases: Array<{
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
    style: string;
    rotation: number;
  }> = [
    {
      top: true,
      bottom: true,
      left: true,
      right: true,
      style: ROAD_TYPE.FOUR_WAY,
      rotation: 0,
    },
    {
      top: false,
      bottom: true,
      left: true,
      right: true,
      style: ROAD_TYPE.THREE_WAY,
      rotation: 0,
    },
    {
      top: true,
      bottom: false,
      left: true,
      right: true,
      style: ROAD_TYPE.THREE_WAY,
      rotation: 180,
    },
    {
      top: true,
      bottom: true,
      left: false,
      right: true,
      style: ROAD_TYPE.THREE_WAY,
      rotation: 90,
    },
    {
      top: true,
      bottom: true,
      left: true,
      right: false,
      style: ROAD_TYPE.THREE_WAY,
      rotation: 270,
    },
    {
      top: true,
      bottom: false,
      left: true,
      right: false,
      style: ROAD_TYPE.CORNER,
      rotation: 180,
    },
    {
      top: true,
      bottom: false,
      left: false,
      right: true,
      style: ROAD_TYPE.CORNER,
      rotation: 90,
    },
    {
      top: false,
      bottom: true,
      left: true,
      right: false,
      style: ROAD_TYPE.CORNER,
      rotation: 270,
    },
    {
      top: false,
      bottom: true,
      left: false,
      right: true,
      style: ROAD_TYPE.CORNER,
      rotation: 0,
    },
    {
      top: true,
      bottom: true,
      left: false,
      right: false,
      style: ROAD_TYPE.STRAIGHT,
      rotation: 0,
    },
    {
      top: false,
      bottom: false,
      left: true,
      right: true,
      style: ROAD_TYPE.STRAIGHT,
      rotation: 90,
    },
    {
      top: true,
      bottom: false,
      left: false,
      right: false,
      style: ROAD_TYPE.END,
      rotation: 180,
    },
    {
      top: false,
      bottom: true,
      left: false,
      right: false,
      style: ROAD_TYPE.END,
      rotation: 0,
    },
    {
      top: false,
      bottom: false,
      left: true,
      right: false,
      style: ROAD_TYPE.END,
      rotation: 270,
    },
    {
      top: false,
      bottom: false,
      left: false,
      right: true,
      style: ROAD_TYPE.END,
      rotation: 90,
    },
  ];

  it.each(cases)(
    'top=$top bottom=$bottom left=$left right=$right -> $style @ $rotation deg',
    ({ top, bottom, left, right, style, rotation }) => {
      const road = new Road(1, 1);
      road.simulate(cityWithRoadNeighbors(top, bottom, left, right));
      expect(road.style).toBe(style);
      expect(road.rotation.y).toBe(rotation);
    }
  );

  it('keeps its default straight style with no road neighbors at all', () => {
    const road = new Road(1, 1);
    road.simulate(cityWithRoadNeighbors(false, false, false, false));
    expect(road.style).toBe(ROAD_TYPE.STRAIGHT);
    expect(road.rotation.y).toBe(0);
  });
});
