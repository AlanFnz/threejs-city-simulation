import { ICity } from '../..';
import { DevelopmentAttribute } from '../attributes/development';
import { Building } from '../building';
import { IZone } from '../interfaces';
import { random } from '../../../utils/rng';

const DEG2RAD = Math.PI / 180;

class Zone extends Building implements IZone {
  style: string;
  development: DevelopmentAttribute;
  hasRoadAccess: boolean;
  rotation: { x: number; y: number };

  constructor(x: number, y: number, maxLevel: number) {
    super(x, y);
    this.style = String.fromCharCode(Math.floor(3 * random()) + 65);
    this.development = new DevelopmentAttribute(this, maxLevel);
    this.hasRoadAccess = false;
    this.rotation = { x: 0, y: 90 * Math.floor(4 * random()) * DEG2RAD }; // Initialize rotation properly
  }

  simulate(city: ICity): void {
    super.simulate(city);
    this.development.simulate(city);
  }
}

export { Zone, IZone };
