import { ResidentialZone } from './building/zones/residentialZone';
import { CommercialZone } from './building/zones/commercialZone';
import { IndustrialZone } from './building/zones/industrialZone';
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
  readonly money: number;
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
  getPowerPlantLoad(plant: ICoordinate): number;
  canAfford(amount: number): boolean;
  spend(amount: number): boolean;
  earn(amount: number): void;
  applyUpkeepDiscount(multiplier: number): void;
  readonly netIncome: number;
  readonly upkeepDiscount: number;
  loadEconomyState(state: { money: number; upkeepDiscount: number }): void;
}

export class City implements ICity {
  size: number;
  tiles: ITile[][];
  private powerGrid: PowerGrid = new PowerGrid();
  private _money: number = CONFIG.ECONOMY.STARTING_MONEY;
  /** Multiplies upkeep before it's charged - milestone rewards can reduce
   * this permanently (e.g. 0.9 = 10% off), stacking multiplicatively. */
  private _upkeepDiscount: number = 1;
  /** income minus upkeep from the last collectEconomy() pass - read by
   * RandomEventsSystem to gauge whether the city is currently struggling,
   * without re-scanning the grid itself. */
  private lastNetIncome: number = 0;
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
      cityEvents.on('civicCoverageChanged', ({ x, y }) =>
        this.recomputeCivicCoverageNear(x, y)
      ),
      cityEvents.on('buildingPlaced', ({ x, y }) => {
        this.getTile(x, y)?.roadAccess?.recompute(this);
        this.cascadePowerAccessChange(x, y);
        const tile = this.getTile(x, y);
        tile?.fireStationCoverage?.recompute(this);
        tile?.policeStationCoverage?.recompute(this);
        tile?.hospitalCoverage?.recompute(this);
        tile?.schoolCoverage?.recompute(this);
      }),
      cityEvents.on('buildingRemoved', ({ x, y }) => {
        // Releasing this tile's own slot (if it had one) may free capacity a
        // neighboring zone previously lost out on - cascade nearby power
        // access too, not just this tile, so that zone can pick it up.
        this.powerGrid.release({ x, y });
        this.cascadePowerAccessChange(x, y);
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
   * A civic building (fire/police/hospital/school) was placed or removed at
   * (x, y). Same bounded-radius idea as recomputeRoadAccessNear - coverage
   * doesn't chain through other coverage, so a one-shot radius sweep is
   * enough (no cascade needed, unlike power access). Uses the largest of
   * the four SEARCH_DISTANCEs so nothing in range of any one of them is missed.
   */
  private recomputeCivicCoverageNear(x: number, y: number): void {
    const { FIRE_STATION, POLICE_STATION, HOSPITAL, SCHOOL } = CONFIG.CIVIC_SERVICES;
    const radius = Math.max(
      FIRE_STATION.SEARCH_DISTANCE,
      POLICE_STATION.SEARCH_DISTANCE,
      HOSPITAL.SEARCH_DISTANCE,
      SCHOOL.SEARCH_DISTANCE
    );
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const tile = this.getTile(x + dx, y + dy);
        tile?.fireStationCoverage?.recompute(this);
        tile?.policeStationCoverage?.recompute(this);
        tile?.hospitalCoverage?.recompute(this);
        tile?.schoolCoverage?.recompute(this);
      }
    }
  }

  /**
   * A power plant or power line was placed or removed at (x, y). Whether
   * it's currently a plant (vs. a line, or gone) is derived from tile state
   * rather than an explicit add/remove flag, same as roadNetworkChanged's
   * handler: placeBuilding/removeBuilding both emit this event, and by the
   * time it fires the tile's building already reflects the new state. Lines
   * never hold capacity, so only plants register/unregister.
   */
  private handlePowerNetworkChanged(x: number, y: number): void {
    const coordinate = { x, y };
    if (this.getTile(x, y)?.building?.type === BUILDING_TYPE.POWER_PLANT) {
      this.powerGrid.registerPlant(coordinate);
    } else {
      this.powerGrid.unregisterPlant(coordinate);
    }
    this.cascadePowerAccessChange(x, y);
  }

  /**
   * Zones now conduct power to already-connected neighbors (see
   * isPowerConductive/findReachablePlants), so a single change can ripple
   * arbitrarily far across a chain of zones - a bounded-radius recompute
   * around just the edited tile isn't enough. Instead this is an
   * incremental worklist: seed it with the same bounded-radius
   * neighborhood the edited tile could possibly affect, then only expand
   * to a tile's neighbors when that tile's own power access actually
   * flips - an unchanged tile can't newly affect what its neighbors see.
   * Cost is proportional to the size of the network region that actually
   * changes, not the total map size, so this stays cheap regardless of
   * how large the city grid grows.
   */
  private cascadePowerAccessChange(startX: number, startY: number): void {
    const radius = CONFIG.ATTRIBUTES.POWER_ACCESS.SEARCH_DISTANCE;
    const queue: ITile[] = [];
    const queued = new Set<string>();
    const enqueue = (tile: ITile | null): void => {
      if (tile && !queued.has(tile.id)) {
        queue.push(tile);
        queued.add(tile.id);
      }
    };

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        enqueue(this.getTile(startX + dx, startY + dy));
      }
    }

    while (queue.length > 0) {
      const tile = queue.shift();
      if (!tile) continue;
      queued.delete(tile.id);
      if (!tile.powerAccess) continue;

      const before = tile.powerAccess.value;
      tile.powerAccess.recompute(this);
      if (tile.powerAccess.value !== before) {
        this.getTileNeighbors(tile.x, tile.y).forEach(enqueue);
      }
    }
  }

  /**
   * Unlike road access, this isn't a plain reachability check: power is a
   * capacity-limited resource shared across every tile in a plant's
   * network, so PowerGrid has to track and enforce which plant is serving
   * which tile. Only zones consume capacity - everything else (grass,
   * roads, power lines, other plants) is never powered and never holds a
   * capacity slot.
   */
  checkPowerAccess(tile: ICoordinate): boolean {
    const building = this.getTileByCoordinate(tile)?.building;

    if (!this.isZoneType(building?.type)) {
      this.powerGrid.release(tile);
      return false;
    }

    return this.powerGrid.tryAssign(
      tile,
      this.findReachablePlants(tile),
      CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY
    );
  }

  /** Zone tiles currently powered by this plant - for the info panel, so the
   * hard per-plant capacity (CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY) isn't
   * an invisible mystery once a city outgrows a single plant. */
  getPowerPlantLoad(plant: ICoordinate): number {
    return this.powerGrid.getCapacityUsed(plant);
  }

  private isZoneType(type: string | undefined): boolean {
    return (
      type === BUILDING_TYPE.RESIDENTIAL ||
      type === BUILDING_TYPE.COMMERCIAL ||
      type === BUILDING_TYPE.INDUSTRIAL
    );
  }

  /**
   * A tile conducts power if it's a line/plant, or if it's a zone that's
   * already confirmed powered - once a building is connected, its
   * already-connected neighbors can relay through it too, so a player only
   * needs to wire up the edge of a developing cluster rather than every
   * single lot. Reads powerAccess.value as already-settled (from the last
   * recompute) rather than re-deriving it recursively here, which is what
   * keeps this a plain traversal instead of infinite recursion -
   * cascadePowerAccessChange is what keeps those cached values fresh as
   * the network changes.
   */
  private isPowerConductive = (tile: ITile): boolean => {
    const type = tile.building?.type;
    if (type === BUILDING_TYPE.POWER_LINE || type === BUILDING_TYPE.POWER_PLANT) {
      return true;
    }
    return this.isZoneType(type) && tile.powerAccess?.value === true;
  };

  /**
   * Two-step lookup: first, every conductive tile (line/plant, or an
   * already-powered zone) within SEARCH_DISTANCE of the zone ("can this
   * zone physically reach the grid" - same radius concept road access uses
   * for "can this tile reach a road"). Then, from each of those entry
   * points, a BFS through only connected conductive tiles (unbounded by
   * distance - a cable run, or a chain of powered zones, can be as long as
   * the player builds it) collecting every plant the network reaches. A
   * plant is always a traversal endpoint, never a pass-through.
   */
  private findReachablePlants(start: ICoordinate): ICoordinate[] {
    const entryPoints = this.findTiles(
      start,
      this.isPowerConductive,
      CONFIG.ATTRIBUTES.POWER_ACCESS.SEARCH_DISTANCE
    );

    const visited = new Set<string>();
    const plants: ICoordinate[] = [];

    for (const entry of entryPoints) {
      if (visited.has(entry.id)) continue;

      const networkQueue: ITile[] = [entry];
      while (networkQueue.length > 0) {
        const tile = networkQueue.shift();
        if (!tile || visited.has(tile.id)) continue;
        visited.add(tile.id);

        if (tile.building?.type === BUILDING_TYPE.POWER_PLANT) {
          plants.push({ x: tile.x, y: tile.y });
          continue; // a plant is a network endpoint, not a pass-through
        }

        networkQueue.push(
          ...this.getTileNeighbors(tile.x, tile.y).filter(
            (neighbor) => !visited.has(neighbor.id) && this.isPowerConductive(neighbor)
          )
        );
      }
    }

    return plants;
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
    this.collectEconomy();
  }

  get money(): number {
    return this._money;
  }

  canAfford(amount: number): boolean {
    return this._money >= amount;
  }

  /** Gated by balance - used for build costs, which should reject placement
   * rather than let the player go into debt for something optional. */
  spend(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this._money -= amount;
    this.emitMoneyChanged(-amount);
    return true;
  }

  /** Unlike spend(), this is unconditional - used for tax income as well as
   * one-off rewards (e.g. milestone bonuses) that aren't gated by balance. */
  earn(amount: number): void {
    if (amount === 0) return;
    this._money += amount;
    this.emitMoneyChanged(amount);
  }

  applyUpkeepDiscount(multiplier: number): void {
    this._upkeepDiscount *= multiplier;
  }

  get netIncome(): number {
    return this.lastNetIncome;
  }

  get upkeepDiscount(): number {
    return this._upkeepDiscount;
  }

  /** Save/load only - bypasses earn()/spend() to set an absolute balance
   * rather than a delta, and restores the upkeep discount multiplier. */
  loadEconomyState(state: { money: number; upkeepDiscount: number }): void {
    this._money = state.money;
    this._upkeepDiscount = state.upkeepDiscount;
    this.emitMoneyChanged(0);
  }

  /** Unconditional, unlike spend() - upkeep applies every tick regardless of
   * balance, so a city can go into the red rather than upkeep silently
   * stopping (which would let players ignore their own maintenance debt). */
  private chargeUpkeep(amount: number): void {
    if (amount === 0) return;
    this._money -= amount;
    this.emitMoneyChanged(-amount);
  }

  private emitMoneyChanged(amount: number): void {
    cityEvents.emit('moneyChanged', { amount, balance: this._money });
  }

  /**
   * Tax income from developed zones (residents/filled jobs) and upkeep cost
   * from infrastructure, collected once per tick alongside the tile
   * simulate pass. Undeveloped/under-construction zones have no residents
   * or workers yet, so they naturally contribute nothing until they finish
   * developing.
   */
  private collectEconomy(): void {
    let income = 0;
    let upkeep = 0;

    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const building = this.getTile(x, y)?.building;
        if (building instanceof ResidentialZone) {
          income += (building.residents?.count ?? 0) * CONFIG.ECONOMY.TAX_PER_RESIDENT;
        } else if (building instanceof CommercialZone || building instanceof IndustrialZone) {
          income += (building.jobs?.filledJobs ?? 0) * CONFIG.ECONOMY.TAX_PER_WORKER;
        } else if (building?.type === BUILDING_TYPE.ROAD) {
          upkeep += CONFIG.ECONOMY.UPKEEP.ROAD;
        } else if (building?.type === BUILDING_TYPE.POWER_PLANT) {
          upkeep += CONFIG.ECONOMY.UPKEEP.POWER_PLANT;
        } else if (building?.type === BUILDING_TYPE.POWER_LINE) {
          upkeep += CONFIG.ECONOMY.UPKEEP.POWER_LINE;
        }
      }
    }

    const discountedUpkeep = upkeep * this._upkeepDiscount;
    this.lastNetIncome = income - discountedUpkeep;
    this.earn(income);
    this.chargeUpkeep(discountedUpkeep);
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
