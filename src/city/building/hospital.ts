import { Building } from './building';
import { BUILDING_TYPE } from './constants';

/** Fixed building, no development/leveling - residential zones within
 * CONFIG.CIVIC_SERVICES.HOSPITAL.SEARCH_DISTANCE get a boosted move-in
 * chance (see ResidentsAttribute.update). */
export class Hospital extends Building {
  constructor(x: number, y: number) {
    super(x, y);
    this.name = 'Hospital';
    this.type = BUILDING_TYPE.HOSPITAL;
  }
}
