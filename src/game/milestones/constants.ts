import { BUILDING_TYPE, BuildingType } from '../../city/building/constants';

export type MilestoneCondition =
  | { type: 'population'; atLeast: number }
  | { type: 'money'; atLeast: number }
  | { type: 'developedZoneCount'; zoneType: BuildingType; atLeast: number };

export type MilestoneReward =
  | { type: 'cash'; amount: number }
  /** multiplies City's running upkeep discount - e.g. 0.9 = 10% off, stacks
   * multiplicatively with any earlier discount reward. */
  | { type: 'upkeepDiscount'; multiplier: number }
  | { type: 'zoneLevelCap'; zoneType: BuildingType; newCap: number }
  | { type: 'unlockTool'; toolId: string };

export interface Milestone {
  id: string;
  title: string;
  condition: MilestoneCondition;
  reward: MilestoneReward;
}

/** Starting set - numbers are a first pass, easy to retune. COMMERCIAL and
 * INDUSTRIAL are the only tools ever gated: RESIDENTIAL/ROAD/POWER_PLANT/
 * POWER_LINE must stay available from the start since a zone only needs
 * road+power access to develop (not jobs), so population can grow before
 * Commercial/Industrial unlock. */
export const MILESTONES: Milestone[] = [
  {
    id: 'pop-10',
    title: 'Reach 10 residents',
    condition: { type: 'population', atLeast: 10 },
    reward: { type: 'cash', amount: 2000 },
  },
  {
    id: 'pop-30',
    title: 'Reach 30 residents',
    condition: { type: 'population', atLeast: 30 },
    reward: { type: 'unlockTool', toolId: BUILDING_TYPE.COMMERCIAL },
  },
  {
    id: 'pop-75',
    title: 'Reach 75 residents',
    condition: { type: 'population', atLeast: 75 },
    reward: { type: 'unlockTool', toolId: BUILDING_TYPE.INDUSTRIAL },
  },
  {
    id: 'money-25000',
    title: 'Bank $25,000',
    condition: { type: 'money', atLeast: 25000 },
    reward: { type: 'upkeepDiscount', multiplier: 0.9 },
  },
  {
    id: 'commercial-5',
    title: 'Develop 5 commercial zones',
    condition: { type: 'developedZoneCount', zoneType: BUILDING_TYPE.COMMERCIAL, atLeast: 5 },
    reward: { type: 'zoneLevelCap', zoneType: BUILDING_TYPE.RESIDENTIAL, newCap: 4 },
  },
  {
    id: 'industrial-5',
    title: 'Develop 5 industrial zones',
    condition: { type: 'developedZoneCount', zoneType: BUILDING_TYPE.INDUSTRIAL, atLeast: 5 },
    reward: { type: 'zoneLevelCap', zoneType: BUILDING_TYPE.COMMERCIAL, newCap: 4 },
  },
];

/** Human-readable description of a reward, for the goals panel. */
export function describeReward(reward: MilestoneReward): string {
  switch (reward.type) {
    case 'cash':
      return `$${reward.amount} bonus`;
    case 'upkeepDiscount':
      return `${Math.round((1 - reward.multiplier) * 100)}% upkeep discount`;
    case 'zoneLevelCap':
      return `${reward.zoneType} zones can reach level ${reward.newCap}`;
    case 'unlockTool':
      return `unlocks ${reward.toolId}`;
  }
}
