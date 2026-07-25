import { ResidentialZone } from './building/zones/residentialZone';
import { ITile, Tile } from './tile';
import { BUILDING_TYPE } from './building/constants';
import { PowerGrid } from './powerGrid';
import CONFIG from '../config';
import { cityEvents, Unsubscribe } from '../events';

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
  findTiles(
    start: ICoordinate,
    filter: (tile: ITile) => boolean,
    maxDistance: number
  ): ITile[];
  getTileNeighbors(x: number, y: number): ITile[];
  checkPowerAccess(tile: ICoordinate): boolean;
}

export class City implements ICity {
  size: number;
  tiles: ITile[][];
  private powerGrid: PowerGrid = new PowerGrid();
  private unsubscribers: Unsubscribe[];

  constructor(size: number) {
    this.size = size;
    this.tiles = this.initTiles(size);
    this.unsubscribers = [
      cityEvents.on('roadNetworkChanged', ({ x, y }) =>
        this.recomputeRoadAccessNear(x, y)
      ),
      cityEvents.on('powerNetworkChanged', ({ x, y }) =>
        this.handlePowerNetworkChanged(x, y)
      ),
      cityEvents.on('buildingPlaced', ({ x, y }) => {
        this.getTile(x, y)?.roadAccess?.recompute(this);
        this.getTile(x, y)?.powerAccess?.recompute(this);
      }),
      cityEvents.on('buildingRemoved', ({ x, y }) => {
        // Releasing this tile's own slot (if it had one) may free capacity a
        // neighboring zone previously lost out on - recompute nearby power
        // access too, not just this tile, so that zone can pick it up.
        this.powerGrid.release({ x, y });
        this.recomputePowerAccessNear(x, y);
      }),
    ];
  }

  /** Unsubscribes from the shared event bus. Call when this City is discarded. */
  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  /**
   * A road changed at (x, y): every tile whose own road-access search
   * (radius SEARCH_DISTANCE) could reach (x, y) needs re-evaluating, which
   * is exactly the tiles within SEARCH_DISTANCE of (x, y) themselves.
   */
  private recomputeRoadAccessNear(x: number, y: number): void {
    const radius = CONFIG.ATTRIBUTES.ROAD_ACCESS.SEARCH_DISTANCE;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        this.getTile(x + dx, y + dy)?.roadAccess?.recompute(this);
      }
    }
  }

  /**
   * A power plant was placed or removed at (x, y). Registration status is
   * derived from current tile state rather than an explicit add/remove flag
   * (mirrors how roadNetworkChanged's handler doesn't need one either):
   * placeBuilding/removeBuilding both emit this event, and by the time it
   * fires the tile's building already reflects the new state.
   */
  private handlePowerNetworkChanged(x: number, y: number): void {
    const plant = { x, y };
    if (this.getTile(x, y)?.building?.type === BUILDING_TYPE.POWER_PLANT) {
      this.powerGrid.registerPlant(plant);
    } else {
      this.powerGrid.unregisterPlant(plant);
    }
    this.recomputePowerAccessNear(x, y);
  }

  /** Same bounded-radius idea as recomputeRoadAccessNear, for power access. */
  private recomputePowerAccessNear(x: number, y: number): void {
    const radius = CONFIG.ATTRIBUTES.POWER_ACCESS.SEARCH_DISTANCE;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        this.getTile(x + dx, y + dy)?.powerAccess?.recompute(this);
      }
    }
  }

  /**
   * Unlike road access, this isn't a plain reachability check: power is a
   * capacity-limited resource shared across every tile in a plant's range,
   * so PowerGrid has to track and enforce which plant is serving which
   * tile. Only zones consume capacity - everything else (grass, roads,
   * other power plants) is never powered and never holds a capacity slot.
   */
  checkPowerAccess(tile: ICoordinate): boolean {
    const building = this.getTileByCoordinate(tile)?.building;
    const isZone =
      building?.type === BUILDING_TYPE.RESIDENTIAL ||
      building?.type === BUILDING_TYPE.COMMERCIAL ||
      building?.type === BUILDING_TYPE.INDUSTRIAL;

    if (!isZone) {
      this.powerGrid.release(tile);
      return false;
    }

    const candidates = this.findTiles(
      tile,
      (t) => t.building?.type === BUILDING_TYPE.POWER_PLANT,
      CONFIG.ATTRIBUTES.POWER_ACCESS.SEARCH_DISTANCE
    ).map((t) => ({ x: t.x, y: t.y }));

    return this.powerGrid.tryAssign(
      tile,
      candidates,
      CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY
    );
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

  /** Same BFS as findTile, but collects every match within range instead of
   * returning on the first one - used where a caller needs to pick among
   * multiple candidates (e.g. power plants with spare capacity) rather than
   * just "is there one nearby". */
  findTiles(
    start: ICoordinate,
    filter: (tile: ITile) => boolean,
    maxDistance: number
  ): ITile[] {
    const startTile = this.getTile(start.x, start.y);
    if (!startTile) return [];

    const visited = new Set<string>();
    const tilesToSearch: ITile[] = [startTile];
    const matches: ITile[] = [];

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
          matches.push(tile);
        }
      }
    }

    return matches;
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
