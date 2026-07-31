export interface GoalsUiState {
  completedCount: number;
  totalCount: number;
  nextTitle: string | null;
  nextReward: string | null;
}

export interface InspectorPersonUiState {
  id: string;
  name: string;
  age: number;
  status: string;
}

export interface InspectorOccupancyUiState {
  label: string;
  current: number;
  maximum: number;
  people: InspectorPersonUiState[];
}

export interface InspectorBuildingUiState {
  type: string;
  title: string;
  category: string;
  state: string | null;
  level: number | null;
  maximumLevel: number | null;
  buildCost: number | null;
  upkeep: number | null;
  roadStyle: string | null;
  powerLoad: number | null;
  powerCapacity: number | null;
  occupancy: InspectorOccupancyUiState | null;
}

export interface InspectorServiceUiState {
  id: string;
  label: string;
  available: boolean;
}

export interface InspectorUiState {
  x: number;
  y: number;
  terrain: string;
  services: InspectorServiceUiState[];
  building: InspectorBuildingUiState | null;
}

export interface UiState {
  money: number;
  population: number;
  activeToolId: string | null;
  isPaused: boolean;
  unlockedToolIds: string[];
  inspector: InspectorUiState | null;
  goals: GoalsUiState;
  toastMessage: string | null;
  debugText: string;
}

export interface UiActions {
  selectTool(toolId: string): void;
  togglePause(): void;
  saveGame(): void;
  loadGame(): void;
  newGame(): void;
}

type UiListener = () => void;

export interface UiController {
  getSnapshot(): UiState;
  subscribe(listener: UiListener): () => void;
  update(patch: Partial<UiState>): void;
  showToast(message: string): void;
  dispose(): void;
}

const TOAST_DURATION_MS = 4000;

export function createUiStore(initialState: UiState): UiController {
  let state = initialState;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<UiListener>();

  const update = (patch: Partial<UiState>): void => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update,
    showToast(message) {
      if (toastTimer) clearTimeout(toastTimer);
      update({ toastMessage: message });
      toastTimer = setTimeout(() => {
        update({ toastMessage: null });
        toastTimer = null;
      }, TOAST_DURATION_MS);
    },
    dispose() {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = null;
      listeners.clear();
    },
  };
}
