import { Building } from './building';
import { BUILDING_TYPE } from './constants';

export class PowerPlant extends Building {
  constructor(x: number, y: number) {
    super(x, y);
    this.name = 'Power Plant';
    this.type = BUILDING_TYPE.POWER_PLANT;
  }
}
