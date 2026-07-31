import CONFIG from '../config';
import { ICity } from '../city';
import { BuildingEntity } from '../city/building/buildingCreator';
import { BUILDING_TYPE, BuildingType } from '../city/building/constants';
import { Road } from '../city/building/road';
import { CommercialZone } from '../city/building/zones/commercialZone';
import { IndustrialZone } from '../city/building/zones/industrialZone';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { Zone } from '../city/building/zones/zone';
import { ITile } from '../city/tile';
import {
  InspectorBuildingUiState,
  InspectorOccupancyUiState,
  InspectorPersonUiState,
  InspectorUiState,
} from '../ui/store';

const BUILDING_LABELS: Record<BuildingType, string> = {
  [BUILDING_TYPE.BUILDING]: 'Building',
  [BUILDING_TYPE.RESIDENTIAL]: 'Residential zone',
  [BUILDING_TYPE.COMMERCIAL]: 'Commercial zone',
  [BUILDING_TYPE.INDUSTRIAL]: 'Industrial zone',
  [BUILDING_TYPE.ROAD]: 'Road',
  [BUILDING_TYPE.POWER_PLANT]: 'Power plant',
  [BUILDING_TYPE.POWER_LINE]: 'Power line',
  [BUILDING_TYPE.FIRE_STATION]: 'Fire station',
  [BUILDING_TYPE.POLICE_STATION]: 'Police station',
  [BUILDING_TYPE.HOSPITAL]: 'Hospital',
  [BUILDING_TYPE.SCHOOL]: 'School',
};

type CostType = keyof typeof CONFIG.ECONOMY.BUILD_COST;
type UpkeepType = keyof typeof CONFIG.ECONOMY.UPKEEP;

function getBuildCost(type: BuildingType): number | null {
  return type in CONFIG.ECONOMY.BUILD_COST
    ? CONFIG.ECONOMY.BUILD_COST[type as CostType]
    : null;
}

function getUpkeep(type: BuildingType): number | null {
  return type in CONFIG.ECONOMY.UPKEEP
    ? CONFIG.ECONOMY.UPKEEP[type as UpkeepType]
    : null;
}

function mapPerson(person: {
  id: string;
  firstName: string;
  surname: string;
  age: number;
  state: string;
}): InspectorPersonUiState {
  return {
    id: person.id,
    name: `${person.firstName} ${person.surname}`,
    age: person.age,
    status: person.state,
  };
}

function getOccupancy(
  building: BuildingEntity
): InspectorOccupancyUiState | null {
  if (building instanceof ResidentialZone) {
    return {
      label: 'Residents',
      current: building.residents.count,
      maximum: building.residents.maximum,
      people: building.residents.all.map(mapPerson),
    };
  }
  if (
    building instanceof CommercialZone ||
    building instanceof IndustrialZone
  ) {
    return {
      label: 'Workers',
      current: building.jobs.filledJobs,
      maximum: building.jobs.maxWorkers,
      people: building.jobs.workers.map(mapPerson),
    };
  }
  return null;
}

function getBuildingState(
  building: BuildingEntity,
  city: ICity
): InspectorBuildingUiState {
  const isZone = building instanceof Zone;
  const isPowerPlant = building.type === BUILDING_TYPE.POWER_PLANT;
  const defaultName = building.name === 'Building';

  return {
    type: building.type,
    title: defaultName ? BUILDING_LABELS[building.type] : building.name,
    category: BUILDING_LABELS[building.type],
    state: isZone ? building.development.state : null,
    level: isZone ? building.development.level : null,
    maximumLevel: isZone ? building.development.maxLevel : null,
    buildCost: getBuildCost(building.type),
    upkeep: getUpkeep(building.type),
    roadStyle: building instanceof Road ? building.style : null,
    powerLoad: isPowerPlant
      ? city.getPowerPlantLoad({ x: building.x, y: building.y })
      : null,
    powerCapacity: isPowerPlant
      ? CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY
      : null,
    occupancy: getOccupancy(building),
  };
}

export function createInspectorUiState(
  tile: ITile,
  city: ICity
): InspectorUiState {
  return {
    x: tile.x,
    y: tile.y,
    terrain: tile.terrain,
    services: [
      { id: 'road', label: 'Road', available: !!tile.roadAccess?.value },
      { id: 'power', label: 'Power', available: !!tile.powerAccess?.value },
      {
        id: 'fire',
        label: 'Fire',
        available: !!tile.fireStationCoverage?.value,
      },
      {
        id: 'police',
        label: 'Police',
        available: !!tile.policeStationCoverage?.value,
      },
      {
        id: 'health',
        label: 'Health',
        available: !!tile.hospitalCoverage?.value,
      },
      {
        id: 'school',
        label: 'School',
        available: !!tile.schoolCoverage?.value,
      },
    ],
    building: tile.building ? getBuildingState(tile.building, city) : null,
  };
}
