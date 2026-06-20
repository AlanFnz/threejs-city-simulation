import { ITile } from "../../city/tile";
import { TOOLBAR_BUTTONS } from "../../ui/constants";
import { GameContext, Tool } from "./tool";

export class BulldozeTool implements Tool {
  readonly id = TOOLBAR_BUTTONS.BULLDOZE.id;

  onTileClick(tile: ITile, _object: THREE.Object3D, context: GameContext): void {
    if (!tile.building) return;
    tile.removeBuilding();
    context.city.simulate();
    context.sceneManager.update(context.city);
  }
}
