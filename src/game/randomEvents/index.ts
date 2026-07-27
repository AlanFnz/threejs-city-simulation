import CONFIG from '../../config';
import { ICity } from '../../city';
import { ITile } from '../../city/tile';
import { Zone } from '../../city/building/zones/zone';
import { CommercialZone } from '../../city/building/zones/commercialZone';
import { IndustrialZone } from '../../city/building/zones/industrialZone';
import { DevelopmentState } from '../../city/building/attributes/development';
import { random } from '../../utils/rng';
import { cityEvents, Unsubscribe } from '../../events';

/**
 * Occasional city-wide events - a windfall grant, a fire, or layoffs - that
 * create variance beyond the steady, predictable simulation. Each reuses an
 * existing mechanic (City.earn, DevelopmentAttribute.state, JobsAttribute.
 * layOffWorkers) rather than inventing new state.
 *
 * The per-tick decision ("should anything happen this tick") stays O(1):
 * abandonedTileKeys is maintained incrementally via events rather than
 * rescanned every tick, and netIncome is read from City (already computed
 * once per tick there). Only the rare tick an event actually fires pays for
 * a grid scan to pick a target - a cost gated by low probability, not by
 * map size.
 */
export class RandomEventsSystem {
  private abandonedTileKeys = new Set<string>();
  private unsubscribers: Unsubscribe[];

  constructor(private city: ICity) {
    this.unsubscribers = [
      cityEvents.on('developmentStateChanged', ({ x, y, state }) => {
        const key = `${x},${y}`;
        if (state === DevelopmentState.ABANDONED) {
          this.abandonedTileKeys.add(key);
        } else {
          this.abandonedTileKeys.delete(key);
        }
      }),
      cityEvents.on('buildingRemoved', ({ x, y }) =>
        this.abandonedTileKeys.delete(`${x},${y}`)
      ),
    ];
  }

  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  /** Called once per unpaused simulation tick, right after City.simulate(). */
  tick(): void {
    if (this.tryWindfall()) return;
    if (this.tryFire()) return;
    this.tryLayoffs();
  }

  private tryWindfall(): boolean {
    const { BASE_CHANCE, MIN_AMOUNT, MAX_AMOUNT } = CONFIG.RANDOM_EVENTS.WINDFALL;
    if (random() >= BASE_CHANCE) return false;

    const amount = Math.round(MIN_AMOUNT + random() * (MAX_AMOUNT - MIN_AMOUNT));
    this.city.earn(amount);
    cityEvents.emit('randomEventTriggered', {
      message: `The city received a $${amount} grant!`,
    });
    return true;
  }

  private tryFire(): boolean {
    const { BASE_CHANCE, CHANCE_PER_ABANDONED_ZONE } = CONFIG.RANDOM_EVENTS.FIRE;
    const chance = BASE_CHANCE + CHANCE_PER_ABANDONED_ZONE * this.abandonedTileKeys.size;
    if (random() >= chance) return false;

    const candidates = this.findDevelopedZoneTiles();
    const target = this.pickRandom(candidates);
    if (!target || !(target.building instanceof Zone)) return false;

    target.building.development.state = DevelopmentState.ABANDONED;
    cityEvents.emit('randomEventTriggered', {
      message: `A fire damaged ${target.building.name} at (${target.x}, ${target.y})!`,
    });
    return true;
  }

  private tryLayoffs(): boolean {
    const { BASE_CHANCE, DEFICIT_MULTIPLIER } = CONFIG.RANDOM_EVENTS.LAYOFFS;
    const chance = this.city.netIncome < 0 ? BASE_CHANCE * DEFICIT_MULTIPLIER : BASE_CHANCE;
    if (random() >= chance) return false;

    const candidates = this.findLayoffTargetTiles();
    const target = this.pickRandom(candidates);
    const building = target?.building;
    if (!(building instanceof CommercialZone) && !(building instanceof IndustrialZone)) {
      return false;
    }

    building.jobs.layOffWorkers();
    cityEvents.emit('randomEventTriggered', {
      message: `Layoffs hit ${building.name} at (${target!.x}, ${target!.y})!`,
    });
    return true;
  }

  /** Excludes zones within a Fire Station's coverage - they're immune to
   * this event entirely, not just less likely. */
  private findDevelopedZoneTiles(): ITile[] {
    const tiles: ITile[] = [];
    for (let x = 0; x < this.city.size; x++) {
      for (let y = 0; y < this.city.size; y++) {
        const tile = this.city.getTile(x, y);
        const building = tile?.building;
        if (
          building instanceof Zone &&
          building.development.state === DevelopmentState.DEVELOPED &&
          !tile?.fireStationCoverage?.value
        ) {
          tiles.push(tile!);
        }
      }
    }
    return tiles;
  }

  private findLayoffTargetTiles(): ITile[] {
    const tiles: ITile[] = [];
    for (let x = 0; x < this.city.size; x++) {
      for (let y = 0; y < this.city.size; y++) {
        const building = this.city.getTile(x, y)?.building;
        if (
          (building instanceof CommercialZone || building instanceof IndustrialZone) &&
          building.development.state === DevelopmentState.DEVELOPED &&
          building.jobs.filledJobs > 0
        ) {
          tiles.push(this.city.getTile(x, y)!);
        }
      }
    }
    return tiles;
  }

  private pickRandom(tiles: ITile[]): ITile | null {
    if (tiles.length === 0) return null;
    return tiles[Math.floor(random() * tiles.length)];
  }
}
