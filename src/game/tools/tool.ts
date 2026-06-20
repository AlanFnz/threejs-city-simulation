import { ICity } from "../../city";
import { ITile } from "../../city/tile";
import { ISceneManager } from "../../sceneManager";

/** What a Tool is allowed to touch, without reaching back into Game itself. */
export interface GameContext {
  city: ICity;
  sceneManager: ISceneManager;
  setFocusedTile(tile: ITile | null): void;
}

export interface Tool {
  readonly id: string;
  onTileClick(tile: ITile, object: THREE.Object3D, context: GameContext): void;
  /** Called while dragging (mouse held) over a tile. Falls back to onTileClick when omitted. */
  onDrag?(tile: ITile, object: THREE.Object3D, context: GameContext): void;
}
