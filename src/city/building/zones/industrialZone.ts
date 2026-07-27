import { Zone } from './zone';
import { generateIndustrialBuildingName } from '../utils';
import { IIndustrialZone } from '../interfaces';
import { BUILDING_TYPE } from '../constants';
import { ICity } from '../..';
import { JobsAttribute } from '../attributes/jobs';
import { ZONE_LEVEL_CAPS } from './zoneLevelCaps';

export class IndustrialZone extends Zone implements IIndustrialZone {
  jobs: JobsAttribute;

  constructor(x: number, y: number) {
    super(x, y, ZONE_LEVEL_CAPS.INDUSTRIAL);
    this.name = generateIndustrialBuildingName();
    this.type = BUILDING_TYPE.INDUSTRIAL;
    this.jobs = new JobsAttribute(this);
  }

  simulate(city: ICity): void {
    super.simulate(city);
    this.jobs.update();
  }

  dispose(): void {
    this.jobs.dispose();
    super.dispose();
  }

  toHTML(): string {
    let html = super.toHTML();
    html += this.jobs.toHTML();
    return html;
  }
}

