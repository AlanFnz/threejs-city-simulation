import { ITile } from "../../city/tile";
import { TOOLBAR_BUTTONS } from "../../ui/constants";
import { GameContext, Tool } from "./tool";

export class SelectTool implements Tool {
  readonly id = TOOLBAR_BUTTONS.SELECT.id;

  onTileClick(
    tile: ITile,
    object: THREE.Object3D,
    context: GameContext
  ): void {
    context.sceneManager.setActiveObject(object);
    context.setFocusedTile(tile);
  }
}
