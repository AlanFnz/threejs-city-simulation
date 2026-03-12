import { ICity } from '..';
import { Building } from './building';
import { BUILDING_TYPE, ROAD_TYPE } from './constants';

export interface IRoad {
  rotation?: { x: number; y: number };
  style: string;
}

export class Road extends Building implements IRoad {
  style: string;
  hideTerrain: boolean;
  rotation: { x: number; y: number };

  constructor(x: number, y: number) {
    super(x, y);
    this.name = 'Two-Lane Road';
    this.type = BUILDING_TYPE.ROAD;
    this.style = ROAD_TYPE.STRAIGHT;
    this.hideTerrain = true;
    this.rotation = { x: 0, y: 0 }; // Ensure rotation is always defined
  }

  simulate(city: ICity): void {
    const top =
      city.getTile(this.x, this.y - 1)?.building?.type === this.type;
    const bottom =
      city.getTile(this.x, this.y + 1)?.building?.type === this.type;
    const left =
      city.getTile(this.x - 1, this.y)?.building?.type === this.type;
    const right =
      city.getTile(this.x + 1, this.y)?.building?.type === this.type;

    if (top && bottom && left && right) {
      this.style = ROAD_TYPE.FOUR_WAY;
      this.rotation.y = 0;
    } else if (!top && bottom && left && right) {
      this.style = ROAD_TYPE.THREE_WAY;
      this.rotation.y = 0;
    } else if (top && !bottom && left && right) {
      this.style = ROAD_TYPE.THREE_WAY;
      this.rotation.y = 180;
    } else if (top && bottom && !left && right) {
      this.style = ROAD_TYPE.THREE_WAY;
      this.rotation.y = 90;
    } else if (top && bottom && left && !right) {
      this.style = ROAD_TYPE.THREE_WAY;
      this.rotation.y = 270;
    } else if (top && !bottom && left && !right) {
      this.style = ROAD_TYPE.CORNER;
      this.rotation.y = 180;
    } else if (top && !bottom && !left && right) {
      this.style = ROAD_TYPE.CORNER;
      this.rotation.y = 90;
    } else if (!top && bottom && left && !right) {
      this.style = ROAD_TYPE.CORNER;
      this.rotation.y = 270;
    } else if (!top && bottom && !left && right) {
      this.style = ROAD_TYPE.CORNER;
      this.rotation.y = 0;
    } else if (top && bottom && !left && !right) {
      this.style = ROAD_TYPE.STRAIGHT;
      this.rotation.y = 0;
    } else if (!top && !bottom && left && right) {
      this.style = ROAD_TYPE.STRAIGHT;
      this.rotation.y = 90;
    } else if (top && !bottom && !left && !right) {
      this.style = ROAD_TYPE.END;
      this.rotation.y = 180;
    } else if (!top && bottom && !left && !right) {
      this.style = ROAD_TYPE.END;
      this.rotation.y = 0;
    } else if (!top && !bottom && left && !right) {
      this.style = ROAD_TYPE.END;
      this.rotation.y = 270;
    } else if (!top && !bottom && !left && right) {
      this.style = ROAD_TYPE.END;
      this.rotation.y = 90;
    }

    this.isMeshOutOfDate = true;
  }

  toHTML(): string {
    let html = super.toHTML();
    html += `
    <span class="info-label">Style </span>
    <span class="info-value">${this.style}</span>
    <br>
    `;
    return html;
  }
}
