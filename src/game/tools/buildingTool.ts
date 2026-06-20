import { ITile } from "../../city/tile";
import { BuildingType } from "../../city/building/constants";
import { GameContext, Tool } from "./tool";

/** One instance per placeable building type (residential, commercial, industrial, road). */
export class BuildingTool implements Tool {
  constructor(public readonly id: BuildingType) {}

  onTileClick(tile: ITile, _object: THREE.Object3D, context: GameContext): void {
    if (tile.building) return;
    tile.placeBuilding(this.id);
    context.city.simulate();
    context.sceneManager.update(context.city);
  }
}
