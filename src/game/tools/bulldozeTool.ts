import { ITile } from "../../city/tile";
import { TOOLBAR_BUTTONS } from "../../ui/constants";
import { GameContext, Tool, ToolUseResult } from "./tool";

export class BulldozeTool implements Tool {
  readonly id = TOOLBAR_BUTTONS.BULLDOZE.id;

  onTileClick(
    tile: ITile,
    _object: THREE.Object3D,
    context: GameContext
  ): ToolUseResult {
    if (!tile.building) {
      return { status: 'rejected', reason: 'emptyTile' };
    }
    tile.removeBuilding();
    context.city.simulate();
    context.sceneManager.update(context.city);
    return { status: 'applied' };
  }
}
