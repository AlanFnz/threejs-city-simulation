import CONFIG from '../config';
import { City, ICity } from '../city';
import { ITile } from '../city/tile';
import { ISceneManager, SceneManager } from '../sceneManager';
import { createUi } from '../ui';
import { TOOLBAR_BUTTONS } from '../ui/constants';
import { GoalsUiState, UiController, UiState } from '../ui/store';
import { setupEventListeners } from './utils';
import { cityEvents, Unsubscribe } from '../events';
import { createTools, GameContext, Tool } from './tools';
import { MilestoneTracker } from './milestones';
import { MILESTONES, describeReward } from './milestones/constants';
import { RandomEventsSystem } from './randomEvents';
import {
  SAVE_KEY,
  blankSave,
  serialize,
  deserialize,
  SaveGameV1,
} from './saveGame';
import { createInspectorUiState } from './inspector';

const AUTOSAVE_INTERVAL_TICKS = 30;

export interface IGame {
  activeToolId: string | null;
  isPaused: boolean;
  focusedObject: ITile | null;
  step(): void;
  selectTool(toolId: string): void;
  togglePause(): void;
  saveGame(): void;
  loadGame(): boolean;
  newGame(): void;
}

export class Game implements IGame {
  activeToolId: string | null = TOOLBAR_BUTTONS.SELECT.id;
  isPaused: boolean = false;
  focusedObject: ITile | null = null;
  lastMove: number = Date.now();
  private tickCount: number = 0;
  private startTime: number = Date.now();
  private city: ICity = new City(CONFIG.CITY.SIZE);
  private milestoneTracker: MilestoneTracker = new MilestoneTracker(this.city);
  private randomEventsSystem: RandomEventsSystem = new RandomEventsSystem(
    this.city
  );
  private ui!: UiController;
  private sceneManager: ISceneManager = new SceneManager(this.city, () => {
    this.loadGame();
    this.sceneManager.start();
    setInterval(this.step.bind(this), 1000);
  });
  private unsubscribers: Unsubscribe[] = [];
  private tools: Record<string, Tool> = createTools();
  private gameContext: GameContext = {
    city: this.city,
    sceneManager: this.sceneManager,
    assetManager: this.sceneManager.assetManager,
    setFocusedTile: (tile) => this.setFocusedTile(tile),
  };
  private lastPreviewTile: ITile | null = null;

  constructor() {
    this.ui = createUi(this.getInitialUiState(), {
      selectTool: (toolId) => this.selectTool(toolId),
      togglePause: () => this.togglePause(),
      saveGame: () => this.saveGame(),
      loadGame: () => this.loadGame(),
      newGame: () => this.newGame(),
    });
    setupEventListeners(
      this.sceneManager,
      this.onMouseDown.bind(this),
      this.onMouseMove.bind(this),
      this.onMouseScroll.bind(this)
    );
    this.subscribeToCityEvents();
    this.updateGoalsPanel();
  }

  /**
   * TopBar and InfoPanel used to be refreshed unconditionally every tick.
   * They now only re-render when an event says something they show actually
   * changed, so cost scales with edits/sim activity instead of map size.
   */
  private subscribeToCityEvents(): void {
    this.unsubscribers.push(
      cityEvents.on('citizenMovedIn', () => this.updateTitleBar()),
      cityEvents.on('citizenMovedOut', () => this.updateTitleBar()),
      cityEvents.on('moneyChanged', () => this.updateMoneyDisplay()),
      cityEvents.on('milestoneCompleted', () => this.onMilestoneCompleted()),
      cityEvents.on('randomEventTriggered', ({ message }) =>
        this.showEventToast(message)
      ),
      cityEvents.on('developmentStateChanged', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('levelChanged', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('citizenMovedIn', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('citizenMovedOut', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('citizenEmployed', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('citizenUnemployed', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('buildingPlaced', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('buildingRemoved', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      )
    );
  }

  /** Unsubscribes from the shared event bus. Call when this Game is discarded. */
  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.ui.dispose();
  }

  private refreshInfoOverlayIfFocused(coordinate: {
    x: number;
    y: number;
  }): void {
    if (
      this.focusedObject &&
      this.focusedObject.x === coordinate.x &&
      this.focusedObject.y === coordinate.y
    ) {
      this.updateInfoOverlay();
    }
  }

  step(): void {
    this.tickCount++;
    this.updateDebugOverlay();
    if (this.isPaused) return;
    this.city.simulate();
    this.randomEventsSystem.tick();
    this.sceneManager.update(this.city);

    if (this.tickCount % AUTOSAVE_INTERVAL_TICKS === 0) this.saveGame();
  }

  saveGame(): void {
    const data = serialize(this.city, this.milestoneTracker);
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  /** Returns whether a save was found and loaded - never throws, so a
   * corrupt or missing save just leaves the current (fresh) city as-is. */
  loadGame(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    let data: SaveGameV1;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.error('Corrupt save data, ignoring:', error);
      return false;
    }

    deserialize(data, this.city, this.milestoneTracker);
    this.onGameStateReplaced();
    return true;
  }

  /** The one irreversible action here - confirm before wiping the save. */
  newGame(): void {
    if (!window.confirm('Start a new game? This clears your current city.')) {
      return;
    }
    localStorage.removeItem(SAVE_KEY);
    deserialize(blankSave(), this.city, this.milestoneTracker);
    this.onGameStateReplaced();
  }

  /** Loading a save or starting fresh both bulk-replace city/milestone
   * state outside the normal incremental event flow for population/tool
   * unlocks - refresh the UI pieces that don't already react to an event. */
  private onGameStateReplaced(): void {
    this.updateTitleBar();
    this.updateMoneyDisplay();
    this.updateGoalsPanel();
    this.refreshUnlockedToolButtons();
    this.sceneManager.update(this.city);
  }

  private refreshUnlockedToolButtons(): void {
    this.ui.update({
      unlockedToolIds: this.milestoneTracker.getState().unlockedToolIds,
    });
  }

  selectTool(toolId: string): void {
    if (!this.milestoneTracker.isUnlocked(toolId)) return;
    this.activeToolId = toolId;
    this.ui.update({ activeToolId: toolId });
    this.sceneManager.deactivateObject();
    this.sceneManager.hidePreviewMesh();
    this.lastPreviewTile = null;
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
    this.ui.update({ isPaused: this.isPaused });
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      event.stopPropagation();
      if (this.isEventFromUiElement(event)) return;
      const selectedObject = this.sceneManager.getSelectedObject(event);
      this.useActiveTool(selectedObject as THREE.Object3D);
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (Date.now() - this.lastMove < 16) return;
    if (this.isEventFromUiElement(event)) return;
    this.lastMove = Date.now();
    const hoverObject = this.sceneManager.getSelectedObject(event);
    this.sceneManager.setHighlightedMesh(hoverObject as THREE.Mesh);
    this.updatePreview(hoverObject as THREE.Object3D | null);
    if (hoverObject && event.buttons & 1) {
      this.useActiveTool(hoverObject as THREE.Object3D, true);
    }

    this.sceneManager.cameraManager.onMouseMove(event);
  }

  private updatePreview(object: THREE.Object3D | null): void {
    const tile = object?.userData as ITile | undefined;
    const tileIsValid = typeof tile?.placeBuilding === 'function';
    const tool = this.activeToolId ? this.tools[this.activeToolId] : undefined;

    if (!tileIsValid || !tool?.getPreview) {
      if (this.lastPreviewTile !== null) this.sceneManager.hidePreviewMesh();
      this.lastPreviewTile = null;
      return;
    }

    if (tile === this.lastPreviewTile) return;
    this.lastPreviewTile = tile as ITile;

    const preview = tool.getPreview(tile as ITile, this.gameContext);
    if (!preview) {
      this.sceneManager.hidePreviewMesh();
      return;
    }
    this.sceneManager.showPreviewMesh(preview.mesh, preview.valid);
  }

  private onMouseScroll(event: WheelEvent): void {
    this.sceneManager.cameraManager.onMouseScroll(event);
  }

  private useActiveTool(
    object: THREE.Object3D | null,
    isDrag: boolean = false
  ): void {
    if (!object) {
      this.updateInfoOverlay(true);
      return;
    }
    const tile = object.userData as ITile;
    // Raycasts can land on non-tile meshes (e.g. a moving vehicle), whose
    // userData is never set to a tile. Ignore those instead of dispatching.
    if (typeof tile?.placeBuilding !== 'function') return;
    const tool = this.activeToolId ? this.tools[this.activeToolId] : undefined;
    if (!tool) return;
    // Defense in depth alongside the toolbar's disabled/locked button state.
    if (
      this.activeToolId &&
      !this.milestoneTracker.isUnlocked(this.activeToolId)
    )
      return;
    const handler = (isDrag && tool.onDrag) || tool.onTileClick;
    handler.call(tool, tile, object, this.gameContext);
  }

  private setFocusedTile(tile: ITile | null): void {
    this.focusedObject = tile;
    this.updateInfoOverlay();
  }

  private updateInfoOverlay(clear?: boolean): void {
    const tile = clear ? null : this.focusedObject || null;
    this.ui.update({
      inspector: tile ? createInspectorUiState(tile, this.city) : null,
    });
  }

  private updateTitleBar(): void {
    this.ui.update({ population: this.city.population });
  }

  private updateMoneyDisplay(): void {
    this.ui.update({ money: this.city.money });
  }

  private showEventToast(message: string): void {
    this.ui.showToast(message);
  }

  private onMilestoneCompleted(): void {
    this.refreshUnlockedToolButtons();
    this.updateGoalsPanel();
  }

  private updateGoalsPanel(): void {
    this.ui.update({ goals: this.getGoalsUiState() });
  }

  /**
   * Ticks and elapsed real seconds should stay in lockstep (1 tick/sec).
   * If the rate drifts from ~1.00/s, the tick loop is firing more than once
   * per second (e.g. a duplicated setInterval).
   */
  private updateDebugOverlay(): void {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const rate = elapsedSeconds > 0 ? this.tickCount / elapsedSeconds : 0;
    this.ui.update({
      debugText: `tick ${this.tickCount} · ${elapsedSeconds.toFixed(
        1
      )}s elapsed · ${rate.toFixed(2)} ticks/s`,
    });
  }

  private getInitialUiState(): UiState {
    return {
      money: this.city.money,
      population: this.city.population,
      activeToolId: this.activeToolId,
      isPaused: this.isPaused,
      unlockedToolIds: this.milestoneTracker.getState().unlockedToolIds,
      inspector: null,
      goals: this.getGoalsUiState(),
      toastMessage: null,
      debugText: '',
    };
  }

  private getGoalsUiState(): GoalsUiState {
    const completedCount = MILESTONES.filter((milestone) =>
      this.milestoneTracker.isCompleted(milestone.id)
    ).length;
    const next = this.milestoneTracker.nextMilestone;
    return {
      completedCount,
      totalCount: MILESTONES.length,
      nextTitle: next?.title ?? null,
      nextReward: next ? describeReward(next.reward) : null,
    };
  }

  private isEventFromUiElement(event: Event): boolean {
    const uiElements = [
      'ui-topbar',
      'ui-toolbar',
      'ui-goals-overlay',
      'ui-info-overlay',
    ];
    return uiElements.some((id) =>
      (event.target as HTMLElement).closest(`#${id}`)
    );
  }
}
