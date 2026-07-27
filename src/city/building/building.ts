import { ICity } from '..';
import CONFIG from '../../config';
import { BUILDING_TYPE, BuildingType } from './constants';
import { IBuilding } from './interfaces';

type CostKey = keyof typeof CONFIG.ECONOMY.BUILD_COST;
type UpkeepKey = keyof typeof CONFIG.ECONOMY.UPKEEP;

function isCostKey(type: BuildingType): type is CostKey {
  return type in CONFIG.ECONOMY.BUILD_COST;
}

function isUpkeepKey(type: BuildingType): type is UpkeepKey {
  return type in CONFIG.ECONOMY.UPKEEP;
}

class Building implements IBuilding {
  id: string = crypto.randomUUID();
  name: string = 'Building';
  type: BuildingType = BUILDING_TYPE.BUILDING;
  isMeshOutOfDate: boolean = true;
  hideTerrain: boolean = false;
  rotation?: { x: number; y: number };

  constructor(public x: number, public y: number) {}

  update(_city: ICity): void {}

  /**
   * update the state of this building by one simulation step
   */
  simulate(_city: ICity): void {}

  /**
   * cleanup before building removal
   */
  dispose(): void {}

  toHTML(): string {
    let html = `
      <div class="info-heading">Building</div>
      <span class="info-label">Name:</span>
      <span class="info-value">${this.name}</span>
      <br>
      <span class="info-label">Type:</span>
      <span class="info-value">${this.type}</span>
      <br>
    `;

    if (isCostKey(this.type)) {
      html += `
        <span class="info-label">Build cost:</span>
        <span class="info-value">$${CONFIG.ECONOMY.BUILD_COST[this.type]}</span>
        <br>
      `;
    }

    if (isUpkeepKey(this.type)) {
      html += `
        <span class="info-label">Upkeep:</span>
        <span class="info-value">$${CONFIG.ECONOMY.UPKEEP[this.type]}/tick</span>
        <br>
      `;
    }

    return html;
  }
}

export { Building };

