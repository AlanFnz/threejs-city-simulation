import { describe, it, expect, vi, beforeEach } from 'vitest';
import { City } from '..';
import { Citizen } from '.';
import { CITIZEN_STATE } from './constants';
import { ResidentialZone } from '../building/zones/residentialZone';
import { CommercialZone } from '../building/zones/commercialZone';
import { DevelopmentState } from '../building/attributes/development';
import { random } from '../../utils/rng';

vi.mock('../../utils/rng', () => ({ random: vi.fn() }));

const mockedRandom = vi.mocked(random);

function developedCommercialZone(
  x: number,
  y: number,
  level = 1
): CommercialZone {
  const zone = new CommercialZone(x, y);
  zone.development.state = DevelopmentState.DEVELOPED;
  zone.development.level = level;
  return zone;
}

describe('Citizen employment lifecycle', () => {
  beforeEach(() => {
    // 0.3 -> working-age adult (age 31), avoids SCHOOL/RETIRED branches
    mockedRandom.mockReturnValue(0.3);
  });

  it('finds a job at a developed workplace within search distance', () => {
    const city = new City(5);
    const workplace = developedCommercialZone(1, 0);
    city.getTile(1, 0)!.building = workplace;

    const citizen = new Citizen(new ResidentialZone(0, 0));
    expect(citizen.state).toBe(CITIZEN_STATE.UNEMPLOYED);

    citizen.step(city);

    expect(citizen.state).toBe(CITIZEN_STATE.EMPLOYED);
    expect(citizen.workplace).toBe(workplace);
    expect(workplace.jobs.workers).toEqual([citizen]);
  });

  it('lays off workers and returns them to unemployed once the workplace is abandoned', () => {
    const city = new City(5);
    const workplace = developedCommercialZone(1, 0);
    city.getTile(1, 0)!.building = workplace;

    const citizen = new Citizen(new ResidentialZone(0, 0));
    citizen.step(city);
    expect(citizen.state).toBe(CITIZEN_STATE.EMPLOYED);

    workplace.development.state = DevelopmentState.ABANDONED;
    workplace.jobs.update(); // lays off all current workers

    expect(citizen.workplace).toBeNull();

    citizen.step(city);
    expect(citizen.state).toBe(CITIZEN_STATE.UNEMPLOYED);
  });

  it('dispose() removes only the disposed citizen from the workplace roster', () => {
    // MAX_WORKERS default is 2, so level 1 gives exactly two job slots.
    const city = new City(5);
    const workplace = developedCommercialZone(1, 0, 1);
    city.getTile(1, 0)!.building = workplace;

    const citizenA = new Citizen(new ResidentialZone(0, 0));
    const citizenB = new Citizen(new ResidentialZone(0, 0));
    citizenA.step(city);
    citizenB.step(city);
    expect(workplace.jobs.workers).toHaveLength(2);

    citizenA.dispose();

    expect(workplace.jobs.workers).toHaveLength(1);
    expect(workplace.jobs.workers).toContain(citizenB);
    expect(workplace.jobs.workers).not.toContain(citizenA);
  });
});
