import { Road } from './road';
import { PowerPlant } from './powerPlant';
import { PowerLine } from './powerLine';
import { FireStation } from './fireStation';
import { PoliceStation } from './policeStation';
import { Hospital } from './hospital';
import { School } from './school';
import { BUILDING_TYPE, BuildingType } from './constants';
import { ResidentialZone } from './zones/residentialZone';
import { CommercialZone } from './zones/commercialZone';
import { IndustrialZone } from './zones/industrialZone';

export type BuildingEntity =
  | ResidentialZone
  | CommercialZone
  | IndustrialZone
  | Road
  | PowerPlant
  | PowerLine
  | FireStation
  | PoliceStation
  | Hospital
  | School;

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
    case BUILDING_TYPE.POWER_LINE:
      return new PowerLine(x, y);
    case BUILDING_TYPE.FIRE_STATION:
      return new FireStation(x, y);
    case BUILDING_TYPE.POLICE_STATION:
      return new PoliceStation(x, y);
    case BUILDING_TYPE.HOSPITAL:
      return new Hospital(x, y);
    case BUILDING_TYPE.SCHOOL:
      return new School(x, y);
    default:
      return undefined;
  }
}

