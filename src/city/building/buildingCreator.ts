import { Road } from './road';
import { PowerPlant } from './powerPlant';
import { BUILDING_TYPE, BuildingType } from './constants';
import { ResidentialZone } from './zones/residentialZone';
import { CommercialZone } from './zones/commercialZone';
import { IndustrialZone } from './zones/industrialZone';

export type BuildingEntity =
  | ResidentialZone
  | CommercialZone
  | IndustrialZone
  | Road
  | PowerPlant;

/**
 * creates a new building object based on the type specified
 * @param x the x-coordinate of the building
 * @param y the y-coordinate of the building
 * @param type the building type
 * @returns a new building object or undefined if type is invalid
 */
export function createBuilding(
  x: number,
  y: number,
  type: BuildingType
): BuildingEntity | undefined {
  switch (type) {
    case BUILDING_TYPE.RESIDENTIAL:
      return new ResidentialZone(x, y);
    case BUILDING_TYPE.COMMERCIAL:
      return new CommercialZone(x, y);
    case BUILDING_TYPE.INDUSTRIAL:
      return new IndustrialZone(x, y);
    case BUILDING_TYPE.ROAD:
      return new Road(x, y);
    case BUILDING_TYPE.POWER_PLANT:
      return new PowerPlant(x, y);
    default:
      return undefined;
  }
}

