import { ICoordinate } from '.';

function key(coordinate: ICoordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

/**
 * Tracks which power plant is powering which tile, so plant capacity can be
 * enforced and released correctly. Unlike road access (a stateless "is
 * there a road nearby" check), power access is a scarce resource shared
 * across every tile in a plant's range, so it needs this bookkeeping rather
 * than a plain BFS per tile.
 */
export class PowerGrid {
  private capacityUsed = new Map<string, number>();
  private assignedPlant = new Map<string, string>();

  /** Zones currently assigned to this plant, for the info panel - 0 if the
   * plant isn't registered (e.g. not yet placed). */
  getCapacityUsed(plant: ICoordinate): number {
    return this.capacityUsed.get(key(plant)) ?? 0;
  }

  /** Idempotent - a plant that already exists keeps its current load. */
  registerPlant(plant: ICoordinate): void {
    const plantKey = key(plant);
    if (!this.capacityUsed.has(plantKey)) {
      this.capacityUsed.set(plantKey, 0);
    }
  }

  /** Frees the plant's capacity; every tile it was powering becomes unassigned. */
  unregisterPlant(plant: ICoordinate): void {
    const plantKey = key(plant);
    this.capacityUsed.delete(plantKey);
    for (const [tileKey, assignedPlantKey] of this.assignedPlant) {
      if (assignedPlantKey === plantKey) {
        this.assignedPlant.delete(tileKey);
      }
    }
  }

  /** Tile no longer needs (or has) power - bulldozed, or not a zone anymore. */
  release(tile: ICoordinate): void {
    const tileKey = key(tile);
    const plantKey = this.assignedPlant.get(tileKey);
    if (plantKey === undefined) return;
    const used = this.capacityUsed.get(plantKey);
    if (used !== undefined) {
      this.capacityUsed.set(plantKey, Math.max(0, used - 1));
    }
    this.assignedPlant.delete(tileKey);
  }

  /**
   * Keeps the tile's existing assignment if it's still a valid candidate;
   * otherwise finds a candidate plant with spare capacity. Returns whether
   * the tile ends up powered.
   */
  tryAssign(
    tile: ICoordinate,
    candidates: ICoordinate[],
    capacity: number
  ): boolean {
    const tileKey = key(tile);
    const currentPlantKey = this.assignedPlant.get(tileKey);
    if (
      currentPlantKey !== undefined &&
      candidates.some((plant) => key(plant) === currentPlantKey)
    ) {
      return true;
    }

    this.release(tile);

    for (const plant of candidates) {
      const plantKey = key(plant);
      const used = this.capacityUsed.get(plantKey) ?? 0;
      if (used < capacity) {
        this.capacityUsed.set(plantKey, used + 1);
        this.assignedPlant.set(tileKey, plantKey);
        return true;
      }
    }

    return false;
  }
}
