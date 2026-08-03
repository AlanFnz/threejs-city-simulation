import type { SimulationSpeed } from '../game/simulationSpeed';

export interface GoalProgressUiState {
  current: number;
  target: number;
  kind: 'population' | 'money' | 'zones';
  unit: string;
}

export interface GoalMilestoneUiState {
  id: string;
  title: string;
  reward: string;
  status: 'completed' | 'current' | 'upcoming';
  progress: GoalProgressUiState | null;
}

export interface GoalsUiState {
  completedCount: number;
  totalCount: number;
  milestones: GoalMilestoneUiState[];
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

export type NotificationTone =
  | 'success'
  | 'warning'
  | 'milestone'
  | 'event';

export interface UiNotification {
  id: number;
  day: number;
  tone: NotificationTone;
  title: string;
  message: string;
}

export type NewUiNotification = Omit<UiNotification, 'id' | 'day'> & {
  day?: number;
};

export interface CensusUiState {
  total: number;
  employed: number;
  unemployed: number;
  students: number;
  retired: number;
  employmentRate: number | null;
}

export interface ZoneCapacityMetricUiState {
  id: 'residential' | 'commercial' | 'industrial';
  occupied: number;
  capacity: number;
  utilization: number | null;
}

export interface ZoneCapacityUiState {
  residential: ZoneCapacityMetricUiState;
  commercial: ZoneCapacityMetricUiState;
  industrial: ZoneCapacityMetricUiState;
}

export interface CityServiceMetricUiState {
  id: 'road' | 'power' | 'fire' | 'police' | 'health' | 'education';
  covered: number;
  total: number;
  percentage: number | null;
}

export interface CityServicesUiState {
  road: CityServiceMetricUiState;
  power: CityServiceMetricUiState;
  fire: CityServiceMetricUiState;
  police: CityServiceMetricUiState;
  health: CityServiceMetricUiState;
  education: CityServiceMetricUiState;
}

export type CityMapTileKind =
  | 'empty'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'power'
  | 'service';

export interface CityMapUiState {
  size: number;
  tiles: CityMapTileKind[];
}

export interface UiState {
  cityName: string;
  simulationDay: number;
  money: number;
  income: number;
  upkeep: number;
  netIncome: number;
  population: number;
  census: CensusUiState;
  zoneCapacity: ZoneCapacityUiState;
  cityServices: CityServicesUiState;
  cityMap: CityMapUiState;
  activeToolId: string | null;
  isPaused: boolean;
  simulationSpeed: SimulationSpeed;
  unlockedToolIds: string[];
  inspector: InspectorUiState | null;
  goals: GoalsUiState;
  notification: UiNotification | null;
  activity: UiNotification[];
  unreadActivityCount: number;
  isHudHidden: boolean;
  debugText: string;
}

export interface UiActions {
  renameCity(name: string): void;
  selectTool(toolId: string): void;
  closeInspector(): void;
  togglePause(): void;
  setSimulationSpeed(speed: SimulationSpeed): void;
  cycleSimulationSpeed(): void;
  saveGame(): void;
  loadGame(): void;
  newGame(): void;
}

type UiListener = () => void;

export interface UiController {
  getSnapshot(): UiState;
  subscribe(listener: UiListener): () => void;
  update(patch: Partial<UiState>): void;
  showNotification(notification: NewUiNotification): void;
  dismissNotification(): void;
  markActivityRead(): void;
  toggleHudVisibility(): void;
  dispose(): void;
}

const NOTIFICATION_DURATION_MS = 4500;
const ACTIVITY_HISTORY_LIMIT = 6;

export function createUiStore(initialState: UiState): UiController {
  let state = initialState;
  let notificationTimer: ReturnType<typeof setTimeout> | null = null;
  let nextNotificationId = 1;
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
    showNotification(notification) {
      if (notificationTimer) clearTimeout(notificationTimer);
      const entry: UiNotification = {
        ...notification,
        id: nextNotificationId++,
        day: notification.day ?? state.simulationDay,
      };
      update({
        notification: entry,
        activity: [entry, ...state.activity].slice(0, ACTIVITY_HISTORY_LIMIT),
        unreadActivityCount: Math.min(
          state.unreadActivityCount + 1,
          ACTIVITY_HISTORY_LIMIT
        ),
      });
      notificationTimer = setTimeout(() => {
        update({ notification: null });
        notificationTimer = null;
      }, NOTIFICATION_DURATION_MS);
    },
    dismissNotification() {
      if (notificationTimer) clearTimeout(notificationTimer);
      notificationTimer = null;
      if (state.notification) update({ notification: null });
    },
    markActivityRead() {
      if (state.unreadActivityCount > 0) update({ unreadActivityCount: 0 });
    },
    toggleHudVisibility() {
      update({ isHudHidden: !state.isHudHidden });
    },
    dispose() {
      if (notificationTimer) clearTimeout(notificationTimer);
      notificationTimer = null;
      listeners.clear();
    },
  };
}
