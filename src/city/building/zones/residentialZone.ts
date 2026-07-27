import { Zone } from './zone';
import { IResidentialZone } from '../interfaces';
import { BUILDING_TYPE } from '../constants';
import { ICity } from '../..';
import { ResidentsAttribute } from '../attributes/residents';
import { ZONE_LEVEL_CAPS } from './zoneLevelCaps';

export class ResidentialZone extends Zone implements IResidentialZone {
  residents: ResidentsAttribute;

  constructor(x: number, y: number) {
    super(x, y, ZONE_LEVEL_CAPS.RESIDENTIAL);
    this.type = BUILDING_TYPE.RESIDENTIAL;
    this.residents = new ResidentsAttribute(this);
  }

  simulate(city: ICity): void {
    super.simulate(city);
    this.residents.update(city);
  }

  dispose(): void {
    this.residents.dispose();
    super.dispose();
  }

  toHTML(): string {
    let html = super.toHTML();
    html += this.residents.toHTML();
    return html;
  }
}

