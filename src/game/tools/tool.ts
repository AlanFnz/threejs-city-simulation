import { ICity } from "../../city";
import { ITile } from "../../city/tile";
import { ISceneManager } from "../../sceneManager";
import { IAssetManager } from "../../assetManager";

/** What a Tool is allowed to touch, without reaching back into Game itself. */
export interface GameContext {
  city: ICity;
  sceneManager: ISceneManager;
  assetManager: IAssetManager;
  setFocusedTile(tile: ITile | null): void;
}

export interface ToolPreview {
  mesh: THREE.Object3D;
  valid: boolean;
}

export type ToolRejectionReason =
  | 'occupiedTile'
  | 'insufficientFunds'
  | 'emptyTile';

export type ToolUseResult =
  | { status: 'applied' }
  | { status: 'rejected'; reason: ToolRejectionReason };

export interface Tool {
  readonly id: string;
  onTileClick(
    tile: ITile,
    object: THREE.Object3D,
    context: GameContext
  ): ToolUseResult;
  /** Called while dragging (mouse held) over a tile. Falls back to onTileClick when omitted. */
  onDrag?(
    tile: ITile,
    object: THREE.Object3D,
    context: GameContext
  ): ToolUseResult;
  /** Ghost mesh shown while hovering a tile with this tool active. */
  getPreview?(tile: ITile, context: GameContext): ToolPreview | null;
}
