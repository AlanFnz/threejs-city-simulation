import { ICity } from "../..";
import { ITile } from "../../tile";
import { BuildingType } from "../constants";

export interface ICivicCoverageAttribute {
  value: boolean;
  recompute(city: ICity): void;
}

/**
 * Generic version of RoadAccessAttribute - a tile is "covered" if a civic
 * building of a given type exists within a given radius. Reused for all
 * four civic services (fire/police/hospital/school) instead of writing
 * four near-identical attribute classes; each just plugs in its own
 * BuildingType/searchDistance from CONFIG.CIVIC_SERVICES.
 *
 * Recomputed reactively (on civicCoverageChanged / buildingPlaced), not once
 * per tick - same reasoning as RoadAccessAttribute.
 */
export class CivicCoverageAttribute implements ICivicCoverageAttribute {
  value = false;

  constructor(
    private tile: ITile,
    private buildingType: BuildingType,
    private searchDistance: number
  ) {}

  recompute(city: ICity): void {
    const covered = city.findTile(
      this.tile,
      (tile) => tile.building?.type === this.buildingType,
      this.searchDistance
    );

    this.value = covered !== null;
  }
}
