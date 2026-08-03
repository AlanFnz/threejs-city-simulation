import CONFIG from '../config';
import { City, ICity } from '../city';
import { ITile } from '../city/tile';
import { ISceneManager, SceneManager } from '../sceneManager';
import { createUi } from '../ui';
import { TOOLBAR_BUTTONS } from '../ui/constants';
import { UiController, UiState } from '../ui/store';
import { setupEventListeners } from './utils';
import { cityEvents, Unsubscribe } from '../events';
import { createTools, GameContext, Tool } from './tools';
import { MilestoneTracker } from './milestones';
import { describeReward, MILESTONES } from './milestones/constants';
import { RandomEventsSystem } from './randomEvents';
import {
  SAVE_KEY,
  blankSave,
  serialize,
  deserialize,
  SaveGameV1,
} from './saveGame';
import { createInspectorUiState } from './inspector';
import { createGoalsUiState } from './goals';
import {
  getNextSimulationSpeed,
  getScheduledStepCount,
  SimulationSpeed,
} from './simulationSpeed';
import { DEFAULT_CITY_NAME, normalizeCityName } from './cityName';
import {
  normalizeSimulationDay,
  STARTING_SIMULATION_DAY,
} from './simulationDay';
import { createCensusUiState } from './census';
import { createToolRejectionNotification } from './toolFeedback';
import { createZoneCapacityUiState } from './zoneCapacity';
import { createCityServicesUiState } from './cityServices';
import { createCityMapUiState } from './cityMap';
import type { CameraFocus } from '../cameraManager';

const AUTOSAVE_INTERVAL_TICKS = 30;

export interface IGame {
  cityName: string;
  simulationDay: number;
  activeToolId: string | null;
  isPaused: boolean;
  simulationSpeed: SimulationSpeed;
  focusedObject: ITile | null;
  step(): void;
  focusMapTile(x: number, y: number): void;
  selectTool(toolId: string): void;
  closeInspector(): void;
  togglePause(): void;
  setSimulationSpeed(speed: SimulationSpeed): void;
  cycleSimulationSpeed(): void;
  renameCity(name: string): void;
  saveGame(): void;
  loadGame(): boolean;
  newGame(): boolean;
}

export class Game implements IGame {
  cityName: string = DEFAULT_CITY_NAME;
  simulationDay: number = STARTING_SIMULATION_DAY;
  activeToolId: string | null = TOOLBAR_BUTTONS.SELECT.id;
  isPaused: boolean = false;
  simulationSpeed: SimulationSpeed = 1;
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
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private sceneManager: ISceneManager = new SceneManager(
    this.city,
    () => {
      this.loadGame();
      this.sceneManager.start();
      this.simulationInterval = setInterval(
        this.runScheduledSteps.bind(this),
        1000
      );
    },
    (focus) => this.updateCameraFocus(focus)
  );
  private unsubscribers: Unsubscribe[] = [];
  private tools: Record<string, Tool> = createTools();
  private gameContext: GameContext = {
    city: this.city,
    sceneManager: this.sceneManager,
    assetManager: this.sceneManager.assetManager,
    setFocusedTile: (tile) => this.setFocusedTile(tile),
  };
  private lastPreviewTile: ITile | null = null;
  private cityMetricsUpdateQueued: boolean = false;
  private cityMapUpdateQueued: boolean = false;

  constructor() {
    this.ui = createUi(this.getInitialUiState(), {
      selectTool: (toolId) => this.selectTool(toolId),
      focusMapTile: (x, y) => this.focusMapTile(x, y),
      closeInspector: () => this.closeInspector(),
      togglePause: () => this.togglePause(),
      setSimulationSpeed: (speed) => this.setSimulationSpeed(speed),
      cycleSimulationSpeed: () => this.cycleSimulationSpeed(),
      renameCity: (name) => this.renameCity(name),
      saveGame: () => this.saveGameWithFeedback(),
      loadGame: () => this.loadGameWithFeedback(),
      newGame: () => this.newGameWithFeedback(),
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
      cityEvents.on('citizenMovedIn', () => this.onPopulationChanged()),
      cityEvents.on('citizenMovedOut', () => this.onPopulationChanged()),
      cityEvents.on('moneyChanged', () => this.onMoneyChanged()),
      cityEvents.on(
        'economyUpdated',
        ({ balance, income, upkeep, netIncome }) =>
          this.ui.update({ money: balance, income, upkeep, netIncome })
      ),
      cityEvents.on('milestoneCompleted', ({ id }) =>
        this.onMilestoneCompleted(id)
      ),
      cityEvents.on('randomEventTriggered', ({ type, message }) =>
        this.showEventNotification(type, message)
      ),
      cityEvents.on('developmentStateChanged', (payload) => {
        this.scheduleCityMetricsUpdate();
        this.updateGoalsPanel();
        this.refreshInfoOverlayIfFocused(payload);
      }),
      cityEvents.on('levelChanged', (payload) => {
        this.scheduleCityMetricsUpdate();
        this.refreshInfoOverlayIfFocused(payload);
      }),
      cityEvents.on('citizenMovedIn', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('citizenMovedOut', (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on('citizenEmployed', (payload) => {
        this.scheduleCityMetricsUpdate();
        this.refreshInfoOverlayIfFocused(payload);
      }),
      cityEvents.on('citizenUnemployed', (payload) => {
        this.scheduleCityMetricsUpdate();
        this.refreshInfoOverlayIfFocused(payload);
      }),
      cityEvents.on('buildingPlaced', (payload) => {
        this.scheduleCityMetricsUpdate();
        this.scheduleCityMapUpdate();
        this.refreshInfoOverlayIfFocused(payload);
      }),
      cityEvents.on('buildingRemoved', (payload) => {
        this.scheduleCityMetricsUpdate();
        this.scheduleCityMapUpdate();
        this.updateGoalsPanel();
        this.refreshInfoOverlayIfFocused(payload);
      })
    );
  }

  /** Unsubscribes from the shared event bus. Call when this Game is discarded. */
  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    this.simulationInterval = null;
    this.ui.dispose();
  }

  private runScheduledSteps(): void {
    const stepCount = getScheduledStepCount(
      this.isPaused,
      this.simulationSpeed
    );
    if (stepCount === 0) {
      this.updateDebugOverlay();
      return;
    }
    for (let step = 0; step < stepCount; step++) this.step();
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
    if (this.isPaused) return;
    this.tickCount++;
    this.simulationDay++;
    this.ui.update({ simulationDay: this.simulationDay });
    this.updateDebugOverlay();
    this.city.simulate();
    this.randomEventsSystem.tick();
    this.sceneManager.update(this.city);

    if (this.tickCount % AUTOSAVE_INTERVAL_TICKS === 0) this.saveGame();
  }

  saveGame(): void {
    const data = serialize(
      this.city,
      this.milestoneTracker,
      this.cityName,
      this.simulationDay
    );
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  private saveGameWithFeedback(): void {
    this.saveGame();
    this.ui.showNotification({
      tone: 'success',
      title: 'City saved',
      message: 'Your latest progress is stored on this device.',
    });
  }

  private loadGameWithFeedback(): void {
    const hadSave = localStorage.getItem(SAVE_KEY) !== null;
    const loaded = this.loadGame();
    this.ui.showNotification(
      loaded
        ? {
            tone: 'success',
            title: 'City loaded',
            message: 'Your latest saved city has been restored.',
          }
        : {
            tone: 'warning',
            title: hadSave ? 'Could not load city' : 'No saved city',
            message: hadSave
              ? 'The stored save could not be read.'
              : 'Save your city before trying to restore it.',
          }
    );
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

    this.cityName = normalizeCityName(data.cityName);
    this.simulationDay = normalizeSimulationDay(data.simulationDay);
    deserialize(data, this.city, this.milestoneTracker);
    this.onGameStateReplaced();
    return true;
  }

  /** The one irreversible action here - confirm before wiping the save. */
  newGame(): boolean {
    if (!window.confirm('Start a new game? This clears your current city.')) {
      return false;
    }
    localStorage.removeItem(SAVE_KEY);
    const freshSave = blankSave();
    this.cityName = normalizeCityName(freshSave.cityName);
    this.simulationDay = normalizeSimulationDay(freshSave.simulationDay);
    deserialize(freshSave, this.city, this.milestoneTracker);
    this.onGameStateReplaced();
    return true;
  }

  private newGameWithFeedback(): void {
    if (!this.newGame()) return;
    this.ui.showNotification({
      tone: 'success',
      title: 'New city started',
      message: 'A fresh map is ready for your plans.',
    });
  }

  /** Loading a save or starting fresh both bulk-replace city/milestone
   * state outside the normal incremental event flow for population/tool
   * unlocks - refresh the UI pieces that don't already react to an event. */
  private onGameStateReplaced(): void {
    this.updateTitleBar();
    this.ui.update({ cityMap: createCityMapUiState(this.city) });
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

  focusMapTile(x: number, y: number): void {
    const tile = this.city.getTile(x, y);
    if (!tile) return;
    this.sceneManager.cameraManager.focusOnTile(tile.x, tile.y);
  }

  private updateCameraFocus(focus: CameraFocus): void {
    this.ui?.update({ cityMapFocus: focus });
  }

  closeInspector(): void {
    this.focusedObject = null;
    this.sceneManager.deactivateObject();
    this.updateInfoOverlay();
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
    this.ui.update({ isPaused: this.isPaused });
  }

  cycleSimulationSpeed(): void {
    this.setSimulationSpeed(getNextSimulationSpeed(this.simulationSpeed));
  }

  setSimulationSpeed(speed: SimulationSpeed): void {
    this.simulationSpeed = speed;
    this.ui.update({ simulationSpeed: this.simulationSpeed });
  }

  renameCity(name: string): void {
    const cityName = normalizeCityName(name);
    if (cityName === this.cityName) return;
    this.cityName = cityName;
    this.ui.update({ cityName });
    this.saveGame();
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
    const result = handler.call(tool, tile, object, this.gameContext);
    if (!isDrag && result.status === 'rejected') {
      this.ui.showNotification(
        createToolRejectionNotification(result.reason, tool.id)
      );
    }
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
    this.ui.update({
      cityName: this.cityName,
      simulationDay: this.simulationDay,
      population: this.city.population,
      census: createCensusUiState(this.city),
      zoneCapacity: createZoneCapacityUiState(this.city),
      cityServices: createCityServicesUiState(this.city),
    });
  }

  private scheduleCityMapUpdate(): void {
    if (this.cityMapUpdateQueued) return;
    this.cityMapUpdateQueued = true;
    queueMicrotask(() => {
      this.cityMapUpdateQueued = false;
      this.ui.update({ cityMap: createCityMapUiState(this.city) });
    });
  }

  /** City events can arrive in bursts while a simulation step is still
   * unwinding. Batch them into one microtask so resident/workplace links are
   * final and each burst causes only one derived-metrics scan/UI update. */
  private scheduleCityMetricsUpdate(): void {
    if (this.cityMetricsUpdateQueued) return;
    this.cityMetricsUpdateQueued = true;
    queueMicrotask(() => {
      this.cityMetricsUpdateQueued = false;
      this.ui.update({
        census: createCensusUiState(this.city),
        zoneCapacity: createZoneCapacityUiState(this.city),
        cityServices: createCityServicesUiState(this.city),
      });
    });
  }

  private onPopulationChanged(): void {
    this.updateTitleBar();
    this.updateGoalsPanel();
  }

  private updateMoneyDisplay(): void {
    this.ui.update({ money: this.city.money, netIncome: this.city.netIncome });
  }

  private onMoneyChanged(): void {
    this.updateMoneyDisplay();
    this.updateGoalsPanel();
  }

  private showEventNotification(
    type: 'windfall' | 'fire' | 'layoffs',
    message: string
  ): void {
    const titles = {
      windfall: 'City grant awarded',
      fire: 'Emergency reported',
      layoffs: 'Economic disruption',
    } as const;
    this.ui.showNotification({
      tone: type === 'windfall' ? 'success' : 'warning',
      title: titles[type],
      message,
    });
  }

  private onMilestoneCompleted(id: string): void {
    this.refreshUnlockedToolButtons();
    this.updateGoalsPanel();
    const milestone = MILESTONES.find((candidate) => candidate.id === id);
    if (!milestone) return;
    this.ui.showNotification({
      tone: 'milestone',
      title: 'Milestone complete',
      message: `${milestone.title} · ${describeReward(milestone.reward)}`,
    });
  }

  private updateGoalsPanel(): void {
    this.ui.update({ goals: this.getGoalsUiState() });
  }

  /**
   * Tick rate should converge on the selected 1x/2x/3x speed while running
   * and remain flat while paused. Unexpected extra rate indicates a duplicated
   * scheduler.
   */
  private updateDebugOverlay(): void {
    if (!CONFIG.DEBUG.SHOW_TICK_RATE) return;
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
      cityName: this.cityName,
      simulationDay: this.simulationDay,
      money: this.city.money,
      income: 0,
      upkeep: 0,
      netIncome: this.city.netIncome,
      population: this.city.population,
      census: createCensusUiState(this.city),
      zoneCapacity: createZoneCapacityUiState(this.city),
      cityServices: createCityServicesUiState(this.city),
      cityMap: createCityMapUiState(this.city),
      cityMapFocus: this.sceneManager.cameraManager.getFocus(),
      activeToolId: this.activeToolId,
      isPaused: this.isPaused,
      simulationSpeed: this.simulationSpeed,
      unlockedToolIds: this.milestoneTracker.getState().unlockedToolIds,
      inspector: null,
      goals: this.getGoalsUiState(),
      notification: null,
      activity: [],
      unreadActivityCount: 0,
      isHudHidden: false,
      debugText: '',
    };
  }

  private getGoalsUiState() {
    return createGoalsUiState(this.milestoneTracker);
  }

  private isEventFromUiElement(event: Event): boolean {
    const uiElements = [
      'ui-topbar',
      'ui-toolbar',
      'ui-goals-overlay',
      'ui-info-overlay',
      'ui-lower-left-overlay',
      'hud-restore-button',
    ];
    return uiElements.some((id) =>
      (event.target as HTMLElement).closest(`#${id}`)
    );
  }
}
