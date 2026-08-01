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
  tone: NotificationTone;
  title: string;
  message: string;
}

export type NewUiNotification = Omit<UiNotification, 'id'>;

export interface UiState {
  money: number;
  population: number;
  activeToolId: string | null;
  isPaused: boolean;
  unlockedToolIds: string[];
  inspector: InspectorUiState | null;
  goals: GoalsUiState;
  notification: UiNotification | null;
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
  showNotification(notification: NewUiNotification): void;
  dispose(): void;
}

const NOTIFICATION_DURATION_MS = 4500;

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
      update({
        notification: { ...notification, id: nextNotificationId++ },
      });
      notificationTimer = setTimeout(() => {
        update({ notification: null });
        notificationTimer = null;
      }, NOTIFICATION_DURATION_MS);
    },
    dispose() {
      if (notificationTimer) clearTimeout(notificationTimer);
      notificationTimer = null;
      listeners.clear();
    },
  };
}
