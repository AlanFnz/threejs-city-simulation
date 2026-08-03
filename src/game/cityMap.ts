import { ICity } from '../city';
import { BUILDING_TYPE, BuildingType } from '../city/building/constants';
import type { CityMapTileKind, CityMapUiState } from '../ui/store';

const TILE_KIND_BY_BUILDING_TYPE: Partial<
  Record<BuildingType, CityMapTileKind>
> = {
  [BUILDING_TYPE.RESIDENTIAL]: 'residential',
  [BUILDING_TYPE.COMMERCIAL]: 'commercial',
  [BUILDING_TYPE.INDUSTRIAL]: 'industrial',
  [BUILDING_TYPE.ROAD]: 'road',
  [BUILDING_TYPE.POWER_PLANT]: 'power-plant',
  [BUILDING_TYPE.POWER_LINE]: 'power-line',
  [BUILDING_TYPE.FIRE_STATION]: 'service',
  [BUILDING_TYPE.POLICE_STATION]: 'service',
  [BUILDING_TYPE.HOSPITAL]: 'service',
  [BUILDING_TYPE.SCHOOL]: 'service',
};

function getCityMapTileKind(type?: BuildingType): CityMapTileKind {
  return (type && TILE_KIND_BY_BUILDING_TYPE[type]) || 'empty';
}

export function createCityMapUiState(city: ICity): CityMapUiState {
  const tiles: CityMapTileKind[] = [];
  for (const column of city.tiles) {
    for (const tile of column) {
      tiles.push(getCityMapTileKind(tile.building?.type));
    }
  }

  return {
    size: city.size,
    tiles,
  };
}
