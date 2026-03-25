import { ResidentialZone } from './building/zones/residentialZone';
import { ITile, Tile } from './tile';

export interface ICoordinate {
  x: number;
  y: number;
}

export interface ICity {
  size: number;
  tiles: ITile[][];
  getTile(x: number, y: number): ITile | null;
  readonly population: number;
  simulate(): void;
  getTileByCoordinate(coordinate: ICoordinate): ITile | null;
  findTile(
    start: ICoordinate,
    filter: (tile: ITile) => boolean,
    maxDistance: number
  ): ITile | null;
  getTileNeighbors(x: number, y: number): ITile[];
}

export class City implements ICity {
  size: number;
  tiles: ITile[][];

  constructor(size: number) {
    this.size = size;
    this.tiles = this.initTiles(size);
  }

  private initTiles(size: number): ITile[][] {
    const tiles = [];
    for (let x = 0; x < size; x++) {
      const column: ITile[] = [];
      for (let y = 0; y < size; y++) {
        const tile = new Tile(x, y);
        column.push(tile);
      }
      tiles.push(column);
    }
    return tiles;
  }

  getTile(x: number, y: number): ITile | null {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
      return null;
    } else {
      return this.tiles[x][y];
    }
  }

  get population(): number {
    let population = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTileByCoordinate({ x, y });
        if (
          tile?.building instanceof ResidentialZone &&
          tile.building.residents
        )
          population += tile.building?.residents?.count ?? 0;
      }
    }
    return population;
  }

  simulate(): void {
    this.tiles.forEach((row) => row.forEach((tile) => tile.simulate(this)));
  }

  getTileByCoordinate(coordinate: ICoordinate) {
    if (
      !coordinate ||
      typeof coordinate.x !== 'number' ||
      typeof coordinate.y !== 'number'
    ) {
      console.error('Invalid or missing coordinate values');
      return null;
    }

    if (
      coordinate.x < 0 ||
      coordinate.y < 0 ||
      coordinate.x >= this.tiles.length ||
      coordinate.y >= this.tiles[coordinate.x].length
    ) {
      console.error('Coordinate out of bounds');
      return null;
    }

    return this.tiles[coordinate.x][coordinate.y];
  }

  getTileByBuildingId(tileId: string): ITile | undefined {
    for (const row of this.tiles) {
      for (const tile of row) {
        if (tile.building?.id === tileId) {
          return tile;
        }
      }
    }
    return undefined;
  }

  findTile(
    start: ICoordinate,
    filter: (tile: ITile) => boolean,
    maxDistance: number
  ): ITile | null {
    const startTile = this.getTile(start.x, start.y);
    if (!startTile) return null;

    const visited = new Set<string>();
    const tilesToSearch: ITile[] = [startTile];

    while (tilesToSearch.length > 0) {
      const tile = tilesToSearch.shift();

      if (tile) {
        if (visited.has(tile.id)) {
          continue;
        } else {
          visited.add(tile.id);
        }

        const distance = startTile.distanceTo(tile);
        if (distance > maxDistance) continue;

        tilesToSearch.push(...this.getTileNeighbors(tile.x, tile.y));

        if (filter(tile)) {
          return tile;
        }
      }
    }

    return null;
  }

  getTileNeighbors(x: number, y: number): ITile[] {
    const neighbors: ITile[] = [];
    if (x > 0) neighbors.push(this.getTile(x - 1, y)!);
    if (x < this.size - 1) neighbors.push(this.getTile(x + 1, y)!);
    if (y > 0) neighbors.push(this.getTile(x, y - 1)!);
    if (y < this.size - 1) neighbors.push(this.getTile(x, y + 1)!);
    return neighbors.filter((t) => t !== undefined);
  }
}
