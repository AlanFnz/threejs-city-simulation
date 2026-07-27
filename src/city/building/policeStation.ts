import { Building } from './building';
import { BUILDING_TYPE } from './constants';

/** Fixed building, no development/leveling - zones within
 * CONFIG.CIVIC_SERVICES.POLICE_STATION.SEARCH_DISTANCE never abandon (see
 * DevelopmentAttribute.simulate). */
export class PoliceStation extends Building {
  constructor(x: number, y: number) {
    super(x, y);
    this.name = 'Police Station';
    this.type = BUILDING_TYPE.POLICE_STATION;
  }
}
