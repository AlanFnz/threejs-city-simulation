import { ActiveToolId } from '../game/constants';
import { Building } from './building/constants';
import { Citizen } from './citizen/constants';
import { Tile } from './tile/constants';

interface Coordinate {
  x: number;
  y: number;
}

interface City {
  size: number;
  tiles: Tile[][];
  update: () => void;
  getPopulation: () => string;
  getTileByCoordinate: (coordinate: Coordinate) => Tile | null;
  getTileByBuildingId: (id: string) => Tile | undefined;
  findTile: (
    start: Coordinate,
    searchCriteria: (tile: Tile) => boolean,
    maxDistance: number
  ) => Tile | null;
}

export { Tile, City, Coordinate };

