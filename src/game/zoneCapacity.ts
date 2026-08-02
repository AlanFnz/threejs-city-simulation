import { ICity } from '../city';
import { DevelopmentState } from '../city/building/attributes/development';
import { CommercialZone } from '../city/building/zones/commercialZone';
import { IndustrialZone } from '../city/building/zones/industrialZone';
import { ResidentialZone } from '../city/building/zones/residentialZone';
import type {
  ZoneCapacityMetricUiState,
  ZoneCapacityUiState,
} from '../ui/store';

function metric(
  id: ZoneCapacityMetricUiState['id'],
  occupied: number,
  capacity: number
): ZoneCapacityMetricUiState {
  return {
    id,
    occupied,
    capacity,
    utilization:
      capacity === 0 ? null : Math.round((occupied / capacity) * 100),
  };
}

export function createZoneCapacityUiState(city: ICity): ZoneCapacityUiState {
  let residents = 0;
  let residentCapacity = 0;
  let commercialWorkers = 0;
  let commercialCapacity = 0;
  let industrialWorkers = 0;
  let industrialCapacity = 0;

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

      if (building instanceof ResidentialZone) {
        residents += building.residents.count;
        residentCapacity += building.residents.maximum;
      } else if (building instanceof CommercialZone) {
        commercialWorkers += building.jobs.filledJobs;
        commercialCapacity += building.jobs.maxWorkers;
      } else if (building instanceof IndustrialZone) {
        industrialWorkers += building.jobs.filledJobs;
        industrialCapacity += building.jobs.maxWorkers;
      }
    }
  }

  return {
    residential: metric('residential', residents, residentCapacity),
    commercial: metric(
      'commercial',
      commercialWorkers,
      commercialCapacity
    ),
    industrial: metric(
      'industrial',
      industrialWorkers,
      industrialCapacity
    ),
  };
}
