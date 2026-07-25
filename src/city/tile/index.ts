import { BuildingEntity, createBuilding } from "../building/buildingCreator";
import { ICity } from "..";
import { BUILDING_TYPE, BuildingType } from "../building/constants";
import {
  IRoadAccessAttribute,
  RoadAccessAttribute,
} from "../building/attributes/roadAccess";
import {
  IPowerAccessAttribute,
  PowerAccessAttribute,
} from "../building/attributes/powerAccess";
import { cityEvents } from "../../events";

export interface ITile {
  id: string;
  x: number;
  y: number;
  terrain: string;
  building: BuildingEntity | null | undefined;
  roadAccess: IRoadAccessAttribute | null | undefined;
  powerAccess: IPowerAccessAttribute | null | undefined;
  distanceTo(tile: ITile): number;
  simulate(city: ICity): void;
  refresh(city: ICity): void;
  removeBuilding(): void;
  placeBuilding(type: string | null): void;
  toHTML(): string;
}

export class Tile implements ITile {
  id: string;
  x: number;
  y: number;
  terrain: string;
  building: BuildingEntity | null | undefined;
  roadAccess: IRoadAccessAttribute | null | undefined;
  powerAccess: IPowerAccessAttribute | null | undefined;

  constructor(x: number, y: number) {
    this.id = crypto.randomUUID();
    this.x = x;
    this.y = y;
    this.terrain = "ground";
    this.building = null;
    this.roadAccess = new RoadAccessAttribute(this);
    this.powerAccess = new PowerAccessAttribute(this);
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
      const wasPowerPlant = this.building.type === BUILDING_TYPE.POWER_PLANT;
      this.building.dispose();
      this.building = null;
      cityEvents.emit("buildingRemoved", { x: this.x, y: this.y });
      if (wasRoad) {
        cityEvents.emit("roadNetworkChanged", { x: this.x, y: this.y });
      }
      if (wasPowerPlant) {
        cityEvents.emit("powerNetworkChanged", { x: this.x, y: this.y });
      }
    }
  }

  placeBuilding(type: BuildingType): void {
    this.building = createBuilding(this.x, this.y, type);
    cityEvents.emit("buildingPlaced", {
      x: this.x,
      y: this.y,
      buildingType: type,
    });
    if (type === BUILDING_TYPE.ROAD) {
      cityEvents.emit("roadNetworkChanged", { x: this.x, y: this.y });
    }
    if (type === BUILDING_TYPE.POWER_PLANT) {
      cityEvents.emit("powerNetworkChanged", { x: this.x, y: this.y });
    }
  }

  toHTML(): string {
    let html = `
      <span class="info-label">Coordinates: </span>
      <span class="info-value">X: ${this.x}, Y: ${this.y}</span>
      <br>
      <span class="info-label">Terrain: </span>
      <span class="info-value">${this.terrain}</span>
      <br>
    `;

    if (this.building) {
      html += this.building.toHTML();
    }

    html += "</div>";
    return html;
  }
}
