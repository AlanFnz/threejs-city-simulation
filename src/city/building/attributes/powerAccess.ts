import { ICity } from "../..";
import { ITile } from "../../tile";

export interface IPowerAccessAttribute {
  tile: ITile;
  value: boolean;
  recompute(city: ICity): void;
}

export class PowerAccessAttribute {
  tile: ITile;
  value: boolean;

  constructor(tile: ITile) {
    this.tile = tile;
    this.value = false;
  }

  /**
   * Unlike RoadAccessAttribute, this can't be a self-contained BFS: whether
   * this tile has power depends on shared capacity across every power
   * plant in range, so the actual computation (and the capacity bookkeeping
   * that comes with it) lives on City - see City.checkPowerAccess.
   */
  recompute(city: ICity): void {
    this.value = city.checkPowerAccess(this.tile);
  }
}
