import { ICity } from '../../city';
import { Zone } from '../../city/building/zones/zone';
import { DevelopmentState } from '../../city/building/attributes/development';
import { ZONE_LEVEL_CAPS } from '../../city/building/zones/zoneLevelCaps';
import { cityEvents, Unsubscribe } from '../../events';
import { Milestone, MilestoneCondition, MilestoneReward, MILESTONES } from './constants';

/** Exported for save/load's "New Game" reset (see src/game/saveGame), so a
 * blank save can't drift from what a fresh MilestoneTracker actually starts with. */
export const STARTING_UNLOCKED_TOOLS = ['SELECT', 'RESIDENTIAL', 'ROAD', 'POWER_PLANT', 'POWER_LINE', 'BULLDOZE'];

export interface IMilestoneTracker {
  isUnlocked(toolId: string): boolean;
  isCompleted(id: string): boolean;
  readonly nextMilestone: Milestone | null;
  getState(): { completed: string[]; unlockedToolIds: string[] };
  restoreState(state: { completed: string[]; unlockedToolIds: string[] }): void;
  dispose(): void;
}

/**
 * Watches the small, fixed MILESTONES list and applies each one's reward the
 * moment its condition is first met. Each incoming event only re-checks the
 * milestones whose condition matches that event's category - population/
 * money events are O(1) per milestone, but a developedZoneCount condition
 * needs a full grid scan, so that one is gated behind developmentStateChanged
 * specifically rather than re-run on every citizen/money tick.
 */
export class MilestoneTracker implements IMilestoneTracker {
  private completed = new Set<string>();
  private unlockedToolIds = new Set<string>(STARTING_UNLOCKED_TOOLS);
  private unsubscribers: Unsubscribe[];

  constructor(private city: ICity) {
    this.unsubscribers = [
      cityEvents.on('citizenMovedIn', () => this.check('population')),
      cityEvents.on('citizenMovedOut', () => this.check('population')),
      cityEvents.on('moneyChanged', () => this.check('money')),
      cityEvents.on('developmentStateChanged', () => this.check('developedZoneCount')),
    ];
  }

  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  isUnlocked(toolId: string): boolean {
    return this.unlockedToolIds.has(toolId);
  }

  isCompleted(id: string): boolean {
    return this.completed.has(id);
  }

  /** For save/load - the reward side effects (cash, upkeep discount, zone
   * level caps) live on City/ZONE_LEVEL_CAPS and are restored separately;
   * this only restores which milestones/tools are already unlocked, so
   * restoring doesn't re-fire any reward. */
  getState(): { completed: string[]; unlockedToolIds: string[] } {
    return {
      completed: Array.from(this.completed),
      unlockedToolIds: Array.from(this.unlockedToolIds),
    };
  }

  restoreState(state: { completed: string[]; unlockedToolIds: string[] }): void {
    this.completed = new Set(state.completed);
    this.unlockedToolIds = new Set(state.unlockedToolIds);
  }

  get nextMilestone(): Milestone | null {
    return MILESTONES.find((milestone) => !this.completed.has(milestone.id)) ?? null;
  }

  private check(conditionType: MilestoneCondition['type']): void {
    for (const milestone of MILESTONES) {
      if (milestone.condition.type !== conditionType) continue;
      if (this.completed.has(milestone.id)) continue;
      if (this.conditionMet(milestone.condition)) this.complete(milestone);
    }
  }

  private conditionMet(condition: MilestoneCondition): boolean {
    switch (condition.type) {
      case 'population':
        return this.city.population >= condition.atLeast;
      case 'money':
        return this.city.money >= condition.atLeast;
      case 'developedZoneCount':
        return this.countDevelopedZones(condition.zoneType) >= condition.atLeast;
    }
  }

  private countDevelopedZones(zoneType: string): number {
    let count = 0;
    for (let x = 0; x < this.city.size; x++) {
      for (let y = 0; y < this.city.size; y++) {
        const building = this.city.getTile(x, y)?.building;
        if (
          building instanceof Zone &&
          building.type === zoneType &&
          building.development.state === DevelopmentState.DEVELOPED
        ) {
          count++;
        }
      }
    }
    return count;
  }

  private complete(milestone: Milestone): void {
    this.completed.add(milestone.id);
    this.applyReward(milestone.reward);
    cityEvents.emit('milestoneCompleted', { id: milestone.id });
  }

  private applyReward(reward: MilestoneReward): void {
    switch (reward.type) {
      case 'cash':
        this.city.earn(reward.amount);
        break;
      case 'upkeepDiscount':
        this.city.applyUpkeepDiscount(reward.multiplier);
        break;
      case 'zoneLevelCap':
        this.raiseZoneLevelCap(reward.zoneType, reward.newCap);
        break;
      case 'unlockTool':
        this.unlockedToolIds.add(reward.toolId);
        break;
    }
  }

  /** Raises the cap for future zones of this type (ZONE_LEVEL_CAPS, read by
   * each zone subclass's constructor) and bumps every already-placed zone
   * of that type too, so the reward applies retroactively. */
  private raiseZoneLevelCap(zoneType: string, newCap: number): void {
    if (zoneType in ZONE_LEVEL_CAPS) {
      ZONE_LEVEL_CAPS[zoneType as keyof typeof ZONE_LEVEL_CAPS] = newCap;
    }
    for (let x = 0; x < this.city.size; x++) {
      for (let y = 0; y < this.city.size; y++) {
        const building = this.city.getTile(x, y)?.building;
        if (building instanceof Zone && building.type === zoneType) {
          building.development.maxLevel = newCap;
        }
      }
    }
  }
}
