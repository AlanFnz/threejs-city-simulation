import { ICity } from '../city';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import CONFIG from '../config';
import type { CensusUiState } from '../ui/store';

export function createCensusUiState(city: ICity): CensusUiState {
  let employed = 0;
  let unemployed = 0;
  let students = 0;
  let retired = 0;

  for (const column of city.tiles) {
    for (const tile of column) {
      if (!(tile.building instanceof ResidentialZone)) continue;

      for (const citizen of tile.building.residents.all) {
        if (citizen.age < CONFIG.CITIZEN.MIN_WORKING_AGE) {
          students++;
        } else if (citizen.age >= CONFIG.CITIZEN.RETIREMENT_AGE) {
          retired++;
        } else if (citizen.workplace) {
          employed++;
        } else {
          unemployed++;
        }
      }
    }
  }

  const workforce = employed + unemployed;
  return {
    total: employed + unemployed + students + retired,
    employed,
    unemployed,
    students,
    retired,
    employmentRate:
      workforce === 0 ? null : Math.round((employed / workforce) * 100),
  };
}
