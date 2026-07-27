import { Building } from './building';
import { BUILDING_TYPE } from './constants';

/** Fixed building, no development/leveling - protects developed zones
 * within CONFIG.CIVIC_SERVICES.FIRE_STATION.SEARCH_DISTANCE from the Fire
 * random event (see RandomEventsSystem). */
export class FireStation extends Building {
  constructor(x: number, y: number) {
    super(x, y);
    this.name = 'Fire Station';
    this.type = BUILDING_TYPE.FIRE_STATION;
  }
}
