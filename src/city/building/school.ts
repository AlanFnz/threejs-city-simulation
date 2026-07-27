import { Building } from './building';
import { BUILDING_TYPE } from './constants';

/** Fixed building, no development/leveling - zones within
 * CONFIG.CIVIC_SERVICES.SCHOOL.SEARCH_DISTANCE level up faster (see
 * DevelopmentAttribute.simulate). */
export class School extends Building {
  constructor(x: number, y: number) {
    super(x, y);
    this.name = 'School';
    this.type = BUILDING_TYPE.SCHOOL;
  }
}
