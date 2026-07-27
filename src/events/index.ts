import type { BuildingType } from '../city/building/constants';
import type { DevelopmentState } from '../city/building/attributes/development';

export type Unsubscribe = () => void;

/**
 * Minimal typed pub/sub. Kept generic (not tied to CityEventMap) so it can
 * back other event maps later without a rewrite.
 */
export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners: {
    [K in keyof EventMap]?: Set<(payload: EventMap[K]) => void>;
  } = {};

  on<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ): Unsubscribe {
    const listeners: Set<(payload: EventMap[K]) => void> =
      this.listeners[event] ?? new Set();
    this.listeners[event] = listeners;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  off<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ): void {
    this.listeners[event]?.delete(listener);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners[event]?.forEach((listener) => listener(payload));
  }

  /** Drops every listener for every event. Mainly useful for test isolation. */
  clear(): void {
    this.listeners = {};
  }
}

export interface CityEventMap {
  [key: string]: unknown;
  buildingPlaced: { x: number; y: number; buildingType: BuildingType };
  buildingRemoved: { x: number; y: number };
  developmentStateChanged: {
    x: number;
    y: number;
    state: DevelopmentState;
    previousState: DevelopmentState;
  };
  levelChanged: { x: number; y: number; level: number; previousLevel: number };
  citizenMovedIn: { citizenId: string; x: number; y: number };
  citizenMovedOut: { citizenId: string; x: number; y: number };
  citizenEmployed: { citizenId: string; x: number; y: number };
  citizenUnemployed: { citizenId: string; x: number; y: number };
  roadNetworkChanged: { x: number; y: number };
  powerNetworkChanged: { x: number; y: number };
  moneyChanged: { amount: number; balance: number };
  milestoneCompleted: { id: string };
  randomEventTriggered: { message: string };
}

export const cityEvents = new EventBus<CityEventMap>();
