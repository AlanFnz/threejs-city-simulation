import CONFIG from "../config";
import { getIcon } from "../assetManager/icons";
import { City, ICity } from "../city";
import { BuildingEntity } from "../city/building/buildingCreator";
import { ITile } from "../city/tile";
import { ISceneManager, SceneManager } from "../sceneManager";
import { createUi } from "../ui";
import { TOOLBAR_BUTTONS, ToggleButton } from "../ui/constants";
import { setupEventListeners } from "./utils";
import { cityEvents, Unsubscribe } from "../events";
import { createTools, GameContext, Tool } from "./tools";

export interface IGame {
  selectedControl: HTMLElement | null;
  activeToolId: string | null;
  isPaused: boolean;
  focusedObject: BuildingEntity | ITile | null;
  step(): void;
  onToolSelected(event: MouseEvent): void;
  togglePause(): void;
}

export class Game implements IGame {
  selectedControl: HTMLElement | null = document.getElementById(
    TOOLBAR_BUTTONS.SELECT.id
  );
  activeToolId: string | null = TOOLBAR_BUTTONS.SELECT.id;
  isPaused: boolean = false;
  focusedObject: BuildingEntity | ITile | null = null;
  lastMove: number = Date.now();
  private tickCount: number = 0;
  private startTime: number = Date.now();
  private city: ICity = new City(CONFIG.CITY.SIZE);
  private sceneManager: ISceneManager = new SceneManager(this.city, () => {
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
    createUi();

    this.selectedControl = document.getElementById(TOOLBAR_BUTTONS.SELECT.id);
    this.selectedControl?.classList.add("selected");
    setupEventListeners(
      this.sceneManager,
      this.onMouseDown.bind(this),
      this.onMouseMove.bind(this),
      this.onMouseScroll.bind(this)
    );
    this.subscribeToCityEvents();
  }

  /**
   * TopBar and InfoPanel used to be refreshed unconditionally every tick.
   * They now only re-render when an event says something they show actually
   * changed, so cost scales with edits/sim activity instead of map size.
   */
  private subscribeToCityEvents(): void {
    this.unsubscribers.push(
      cityEvents.on("citizenMovedIn", () => this.updateTitleBar()),
      cityEvents.on("citizenMovedOut", () => this.updateTitleBar()),
      cityEvents.on("moneyChanged", () => this.updateMoneyDisplay()),
      cityEvents.on("developmentStateChanged", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on("levelChanged", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on("citizenMovedIn", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on("citizenMovedOut", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on("citizenEmployed", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on("citizenUnemployed", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on("buildingPlaced", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      ),
      cityEvents.on("buildingRemoved", (payload) =>
        this.refreshInfoOverlayIfFocused(payload)
      )
    );
  }

  /** Unsubscribes from the shared event bus. Call when this Game is discarded. */
  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
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
    this.sceneManager.update(this.city);
  }

  onToolSelected(event: MouseEvent): void {
    if (this.selectedControl) {
      this.selectedControl.classList.remove("selected");
    }
    this.selectedControl = event.target as HTMLElement;
    this.selectedControl.classList.add("selected");
    this.activeToolId = this.selectedControl.getAttribute("data-type") || null;
    this.sceneManager.deactivateObject();
    this.sceneManager.hidePreviewMesh();
    this.lastPreviewTile = null;
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;

    const toggleButton = document.getElementById(
      TOOLBAR_BUTTONS.TOGGLE_PAUSE.id
    ) as HTMLButtonElement;

    if (toggleButton) {
      const toggleButtonInfo = TOOLBAR_BUTTONS.TOGGLE_PAUSE as ToggleButton;
      const newState = this.isPaused
        ? toggleButtonInfo.uiTextPlay
        : toggleButtonInfo.uiTextPause;
      const newIcon = getIcon(
        this.isPaused ? toggleButtonInfo.iconPlay : toggleButtonInfo.iconPause
      );

      toggleButton.innerHTML = `<img src="${newIcon}" alt="${newState}" class="toolbar-icon" style="width: 100%; height: 100%; pointer-events: none;">`;
      toggleButton.dataset.state = newState;
      if (this.isPaused) {
        toggleButton.classList.add("selected");
      } else {
        toggleButton.classList.remove("selected");
      }
    }
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
    const tileIsValid = typeof tile?.placeBuilding === "function";
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
    if (typeof tile?.placeBuilding !== "function") return;
    const tool = this.activeToolId ? this.tools[this.activeToolId] : undefined;
    if (!tool) return;
    const handler = (isDrag && tool.onDrag) || tool.onTileClick;
    handler.call(tool, tile, object, this.gameContext);
  }

  private setFocusedTile(tile: ITile | null): void {
    this.focusedObject = tile;
    this.updateInfoOverlay();
  }

  private updateInfoOverlay(clear?: boolean): void {
    const infoPanel = document.getElementById("info-panel");
    const infoOverlayDetails = document.getElementById("info-overlay-details");
    const tile = clear ? null : this.focusedObject || null;
    if (infoOverlayDetails)
      infoOverlayDetails.innerHTML = tile ? tile.toHTML() : "";
    infoPanel?.classList.toggle("visible", !!tile);
  }

  private updateTitleBar(): void {
    const populationCounter = document.getElementById("population-counter");
    if (populationCounter)
      populationCounter.textContent = this.city.population.toString();
  }

  private updateMoneyDisplay(): void {
    const moneyCounter = document.getElementById("money-counter");
    if (!moneyCounter) return;
    moneyCounter.textContent = Math.floor(this.city.money).toString();
    moneyCounter.classList.toggle("low-funds", this.city.money < 0);
  }

  /**
   * Ticks and elapsed real seconds should stay in lockstep (1 tick/sec).
   * If the rate drifts from ~1.00/s, the tick loop is firing more than once
   * per second (e.g. a duplicated setInterval).
   */
  private updateDebugOverlay(): void {
    const debugTick = document.getElementById("debug-tick");
    if (!debugTick) return;
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const rate = elapsedSeconds > 0 ? this.tickCount / elapsedSeconds : 0;
    debugTick.textContent = `tick ${this.tickCount} · ${elapsedSeconds.toFixed(
      1
    )}s elapsed · ${rate.toFixed(2)} ticks/s`;
  }

  private isEventFromUiElement(event: Event): boolean {
    const uiElements = ["ui-topbar", "ui-toolbar", "ui-info-overlay"];
    return uiElements.some((id) =>
      (event.target as HTMLElement).closest(`#${id}`)
    );
  }
}
