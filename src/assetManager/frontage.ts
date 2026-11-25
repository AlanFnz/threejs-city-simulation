import type { ICity } from '../city';
import { BUILDING_TYPE, type BuildingType } from '../city/building/constants';
import { ModelKey } from './constants';

// In the baked GLBs the front is +Z. Coordinates are measured at the door,
// porch step or loading bay, in tile units, before the instance is rotated.
const factoryDoor = [0, 0.277] as const;
const oldFactoryDoor = [0, 0.373] as const;
const warehouseDoor = [0.17, 0.2] as const;
export const ENTRANCES: Partial<Record<ModelKey, readonly [number, number]>> = {
  [ModelKey.UNDER_CONSTRUCTION]: [0, 0.415],
  [ModelKey.RESIDENTIAL_A1]: [-0.065, 0.225],
  [ModelKey.RESIDENTIAL_B1]: [0, 0.222],
  [ModelKey.RESIDENTIAL_C1]: [-0.17, 0.243],
  [ModelKey.RESIDENTIAL_A2]: [0, 0.18],
  [ModelKey.RESIDENTIAL_B2]: [0, 0.19],
  [ModelKey.RESIDENTIAL_C2]: [0.07, 0.219],
  [ModelKey.RESIDENTIAL_A3]: [0, 0.3],
  [ModelKey.RESIDENTIAL_B3]: [0, 0.289],
  [ModelKey.RESIDENTIAL_C3]: [0, 0.243],
  [ModelKey.COMMERCIAL_A1]: [0.12, 0.144],
  [ModelKey.COMMERCIAL_B1]: [0, 0.233],
  [ModelKey.COMMERCIAL_C1]: [0, 0.171],
  [ModelKey.COMMERCIAL_A2]: [0, 0.103],
  [ModelKey.COMMERCIAL_B2]: [0, 0.267],
  [ModelKey.COMMERCIAL_C2]: [0, 0.23],
  [ModelKey.COMMERCIAL_A3]: [0, 0.233],
  [ModelKey.COMMERCIAL_B3]: [0, 0.2],
  [ModelKey.COMMERCIAL_C3]: [0, 0.318],
  [ModelKey.INDUSTRIAL_A1]: factoryDoor,
  [ModelKey.INDUSTRIAL_A2]: factoryDoor,
  [ModelKey.INDUSTRIAL_A3]: factoryDoor,
  [ModelKey.INDUSTRIAL_B1]: oldFactoryDoor,
  [ModelKey.INDUSTRIAL_B2]: oldFactoryDoor,
  [ModelKey.INDUSTRIAL_B3]: oldFactoryDoor,
  [ModelKey.INDUSTRIAL_C1]: warehouseDoor,
  [ModelKey.INDUSTRIAL_C2]: warehouseDoor,
  [ModelKey.INDUSTRIAL_C3]: warehouseDoor,
  [ModelKey.FIRE_STATION]: [-0.1, 0.157],
  [ModelKey.POLICE_STATION]: [0, 0.198],
  [ModelKey.SCHOOL]: [0, 0.224],
  [ModelKey.HOSPITAL]: [-0.02, 0.233],
  [ModelKey.POWER_PLANT]: [0, 0.533],
};

export const SIDES = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
] as const;

export function getBuildingFacing(
  city: ICity,
  x: number,
  y: number,
  type: BuildingType
): number | null {
  if (type === BUILDING_TYPE.ROAD) return null;
  if (type === BUILDING_TYPE.POWER_LINE) return null;
  const side = SIDES.findIndex(
    (offset) =>
      city.getTile(x + offset.x, y + offset.y)?.building?.type ===
      BUILDING_TYPE.ROAD
  );
  return side < 0 ? null : side;
}
