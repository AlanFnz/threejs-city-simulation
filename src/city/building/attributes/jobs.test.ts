import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommercialZone } from '../zones/commercialZone';
import { ResidentialZone } from '../zones/residentialZone';
import { DevelopmentState } from './development';
import CONFIG from '../../../config';
import { Citizen } from '../../citizen';
import { cityEvents } from '../../../events';

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

describe('JobsAttribute.hire / layOff', () => {
  beforeEach(() => {
    cityEvents.clear();
  });

  it('hire() adds the citizen to workers and emits citizenEmployed', () => {
    const zone = new CommercialZone(2, 3);
    const citizen = new Citizen(new ResidentialZone(0, 0));
    const listener = vi.fn();
    cityEvents.on('citizenEmployed', listener);

    zone.jobs.hire(citizen);

    expect(zone.jobs.workers).toContain(citizen);
    expect(listener).toHaveBeenCalledWith({
      citizenId: citizen.id,
      x: 2,
      y: 3,
    });
  });

  it('layOff() removes only the given citizen and emits citizenUnemployed', () => {
    const zone = new CommercialZone(0, 0);
    const citizenA = new Citizen(new ResidentialZone(0, 0));
    const citizenB = new Citizen(new ResidentialZone(0, 0));
    zone.jobs.hire(citizenA);
    zone.jobs.hire(citizenB);
    const listener = vi.fn();
    cityEvents.on('citizenUnemployed', listener);

    zone.jobs.layOff(citizenA);

    expect(zone.jobs.workers).not.toContain(citizenA);
    expect(zone.jobs.workers).toContain(citizenB);
    expect(listener).toHaveBeenCalledWith({
      citizenId: citizenA.id,
      x: 0,
      y: 0,
    });
  });

  it('layOff() on a citizen that is not a worker does nothing and emits nothing', () => {
    const zone = new CommercialZone(0, 0);
    const citizen = new Citizen(new ResidentialZone(0, 0));
    const listener = vi.fn();
    cityEvents.on('citizenUnemployed', listener);

    zone.jobs.layOff(citizen);

    expect(listener).not.toHaveBeenCalled();
  });

  it('layOffWorkers() clears the roster and emits citizenUnemployed per worker', () => {
    const zone = new CommercialZone(0, 0);
    const citizenA = new Citizen(new ResidentialZone(0, 0));
    const citizenB = new Citizen(new ResidentialZone(0, 0));
    zone.jobs.hire(citizenA);
    zone.jobs.hire(citizenB);
    const listener = vi.fn();
    cityEvents.on('citizenUnemployed', listener);

    zone.jobs.layOffWorkers();

    expect(zone.jobs.workers).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
