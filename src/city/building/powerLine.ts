import { Building } from './building';
import { BUILDING_TYPE } from './constants';

/**
 * A fixed pole, same shape regardless of neighbors (unlike Road, which
 * auto-styles into 5 shapes) - connectivity for the power network is
 * tracked separately by City, not on this class.
 */
export class PowerLine extends Building {
  constructor(x: number, y: number) {
    super(x, y);
    this.name = 'Power Line';
    this.type = BUILDING_TYPE.POWER_LINE;
  }
}
