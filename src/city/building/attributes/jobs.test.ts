import { describe, it, expect } from 'vitest';
import { CommercialZone } from '../zones/commercialZone';
import { DevelopmentState } from './development';
import CONFIG from '../../../config';

describe('JobsAttribute.maxWorkers', () => {
  it('is zero while undeveloped', () => {
    const zone = new CommercialZone(0, 0);
    expect(zone.development.state).toBe(DevelopmentState.UNDEVELOPED);
    expect(zone.jobs.maxWorkers).toBe(0);
  });

  it('scales exponentially with development level once developed', () => {
    const zone = new CommercialZone(0, 0);
    zone.development.state = DevelopmentState.DEVELOPED;

    zone.development.level = 1;
    expect(zone.jobs.maxWorkers).toBe(CONFIG.ZONE.MAX_WORKERS ** 1);

    zone.development.level = 2;
    expect(zone.jobs.maxWorkers).toBe(CONFIG.ZONE.MAX_WORKERS ** 2);
  });

  it('is zero once abandoned', () => {
    const zone = new CommercialZone(0, 0);
    zone.development.state = DevelopmentState.DEVELOPED;
    zone.development.level = 2;

    zone.development.state = DevelopmentState.ABANDONED;
    expect(zone.jobs.maxWorkers).toBe(0);
  });
});
