import { ICity } from '../city';
import { DevelopmentState } from '../city/building/attributes/development';
import { CommercialZone } from '../city/building/zones/commercialZone';
import { IndustrialZone } from '../city/building/zones/industrialZone';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import type {
  CityServiceMetricUiState,
  CityServicesUiState,
} from '../ui/store';

function metric(
  id: CityServiceMetricUiState['id'],
  covered: number,
  total: number
): CityServiceMetricUiState {
  return {
    id,
    covered,
    total,
    percentage: total === 0 ? null : Math.round((covered / total) * 100),
  };
}

export function createCityServicesUiState(city: ICity): CityServicesUiState {
  let total = 0;
  let road = 0;
  let power = 0;
  let fire = 0;
  let police = 0;
  let health = 0;
  let education = 0;

  for (const column of city.tiles) {
    for (const tile of column) {
      const building = tile.building;
      if (
        !(
          building instanceof ResidentialZone ||
          building instanceof CommercialZone ||
          building instanceof IndustrialZone
        ) ||
        building.development.state !== DevelopmentState.DEVELOPED
      ) {
        continue;
      }

      total++;
      if (tile.roadAccess?.value) road++;
      if (tile.powerAccess?.value) power++;
      if (tile.fireStationCoverage?.value) fire++;
      if (tile.policeStationCoverage?.value) police++;
      if (tile.hospitalCoverage?.value) health++;
      if (tile.schoolCoverage?.value) education++;
    }
  }

  return {
    road: metric('road', road, total),
    power: metric('power', power, total),
    fire: metric('fire', fire, total),
    police: metric('police', police, total),
    health: metric('health', health, total),
    education: metric('education', education, total),
  };
}
