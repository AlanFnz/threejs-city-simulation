import { afterEach, describe, expect, it } from 'vitest';
import { City } from '../city';
import { BUILDING_TYPE } from '../city/building/constants';
import { CommercialZone } from '../city/building/zones/commercialZone';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import { Citizen } from '../city/citizen';
import { CITIZEN_STATE } from '../city/citizen/constants';
import { cityEvents } from '../events';
import { createCensusUiState } from './census';

afterEach(() => cityEvents.clear());

describe('createCensusUiState', () => {
  it('returns an empty census for a new city', () => {
    expect(createCensusUiState(new City(4))).toEqual({
      total: 0,
      employed: 0,
      unemployed: 0,
      students: 0,
      retired: 0,
      employmentRate: null,
    });
  });

  it('groups residents by life and employment status', () => {
    const city = new City(4);
    const homeTile = city.getTile(0, 0)!;
    homeTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const home = homeTile.building as ResidentialZone;
    const jobTile = city.getTile(1, 0)!;
    jobTile.placeBuilding(BUILDING_TYPE.COMMERCIAL);
    const job = jobTile.building as CommercialZone;

    const citizen = (id: string, age: number) =>
      new Citizen(home, {
        id,
        firstName: id,
        surname: 'Resident',
        age,
        state: CITIZEN_STATE.UNEMPLOYED,
      });
    const student = citizen('student', 12);
    const worker = citizen('worker', 30);
    const jobSeeker = citizen('job-seeker', 40);
    const retiree = citizen('retiree', 70);
    home.residents.restore([student, worker, jobSeeker, retiree]);
    worker.setWorkplace(job);

    expect(createCensusUiState(city)).toEqual({
      total: 4,
      employed: 1,
      unemployed: 1,
      students: 1,
      retired: 1,
      employmentRate: 50,
    });
  });
});
