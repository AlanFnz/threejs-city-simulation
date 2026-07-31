import { BuildingEntity, createBuilding } from '../building/buildingCreator';
import { ICity } from '..';
import { BUILDING_TYPE, BuildingType } from '../building/constants';
import {
  IRoadAccessAttribute,
  RoadAccessAttribute,
} from '../building/attributes/roadAccess';
import {
  IPowerAccessAttribute,
  PowerAccessAttribute,
} from '../building/attributes/powerAccess';
import {
  ICivicCoverageAttribute,
  CivicCoverageAttribute,
} from '../building/attributes/civicCoverage';
import { cityEvents } from '../../events';
import CONFIG from '../../config';

const CIVIC_BUILDING_TYPES = [
  BUILDING_TYPE.FIRE_STATION,
  BUILDING_TYPE.POLICE_STATION,
  BUILDING_TYPE.HOSPITAL,
  BUILDING_TYPE.SCHOOL,
] as const;

export interface ITile {
  id: string;
  x: number;
  y: number;
  terrain: string;
  building: BuildingEntity | null | undefined;
  roadAccess: IRoadAccessAttribute | null | undefined;
  powerAccess: IPowerAccessAttribute | null | undefined;
  fireStationCoverage: ICivicCoverageAttribute | null | undefined;
  policeStationCoverage: ICivicCoverageAttribute | null | undefined;
  hospitalCoverage: ICivicCoverageAttribute | null | undefined;
  schoolCoverage: ICivicCoverageAttribute | null | undefined;
  distanceTo(tile: ITile): number;
  simulate(city: ICity): void;
  refresh(city: ICity): void;
  removeBuilding(): void;
  placeBuilding(type: string | null): void;
}

export class Tile implements ITile {
  id: string;
  x: number;
  y: number;
  terrain: string;
  building: BuildingEntity | null | undefined;
  roadAccess: IRoadAccessAttribute | null | undefined;
  powerAccess: IPowerAccessAttribute | null | undefined;
  fireStationCoverage: ICivicCoverageAttribute | null | undefined;
  policeStationCoverage: ICivicCoverageAttribute | null | undefined;
  hospitalCoverage: ICivicCoverageAttribute | null | undefined;
  schoolCoverage: ICivicCoverageAttribute | null | undefined;

  constructor(x: number, y: number) {
    this.id = crypto.randomUUID();
    this.x = x;
    this.y = y;
    this.terrain = 'ground';
    this.building = null;
    this.roadAccess = new RoadAccessAttribute(this);
    this.powerAccess = new PowerAccessAttribute(this);
    this.fireStationCoverage = new CivicCoverageAttribute(
      this,
      BUILDING_TYPE.FIRE_STATION,
      CONFIG.CIVIC_SERVICES.FIRE_STATION.SEARCH_DISTANCE
    );
    this.policeStationCoverage = new CivicCoverageAttribute(
      this,
      BUILDING_TYPE.POLICE_STATION,
      CONFIG.CIVIC_SERVICES.POLICE_STATION.SEARCH_DISTANCE
    );
    this.hospitalCoverage = new CivicCoverageAttribute(
      this,
      BUILDING_TYPE.HOSPITAL,
      CONFIG.CIVIC_SERVICES.HOSPITAL.SEARCH_DISTANCE
    );
    this.schoolCoverage = new CivicCoverageAttribute(
      this,
      BUILDING_TYPE.SCHOOL,
      CONFIG.CIVIC_SERVICES.SCHOOL.SEARCH_DISTANCE
    );
  }

  distanceTo(tile: Tile): number {
    return Math.abs(this.x - tile.x) + Math.abs(this.y - tile.y);
  }

  refresh(city: ICity): void {
    this.building?.simulate(city);
  }

  simulate(city: ICity): void {
    this.building?.simulate(city);
  }

  removeBuilding(): void {
    if (this.building) {
      const wasRoad = this.building.type === BUILDING_TYPE.ROAD;
      const wasPowerInfrastructure =
        this.building.type === BUILDING_TYPE.POWER_PLANT ||
        this.building.type === BUILDING_TYPE.POWER_LINE;
      const wasCivicBuilding = (
        CIVIC_BUILDING_TYPES as readonly string[]
      ).includes(this.building.type);
      this.building.dispose();
      this.building = null;
      cityEvents.emit('buildingRemoved', { x: this.x, y: this.y });
      if (wasRoad) {
        cityEvents.emit('roadNetworkChanged', { x: this.x, y: this.y });
      }
      if (wasPowerInfrastructure) {
        cityEvents.emit('powerNetworkChanged', { x: this.x, y: this.y });
      }
      if (wasCivicBuilding) {
        cityEvents.emit('civicCoverageChanged', { x: this.x, y: this.y });
      }
    }
  }

  placeBuilding(type: BuildingType): void {
    this.building = createBuilding(this.x, this.y, type);
    cityEvents.emit('buildingPlaced', {
      x: this.x,
      y: this.y,
      buildingType: type,
    });
    if (type === BUILDING_TYPE.ROAD) {
      cityEvents.emit('roadNetworkChanged', { x: this.x, y: this.y });
    }
    if (
      type === BUILDING_TYPE.POWER_PLANT ||
      type === BUILDING_TYPE.POWER_LINE
    ) {
      cityEvents.emit('powerNetworkChanged', { x: this.x, y: this.y });
    }
    if ((CIVIC_BUILDING_TYPES as readonly string[]).includes(type)) {
      cityEvents.emit('civicCoverageChanged', { x: this.x, y: this.y });
    }
  }
}
