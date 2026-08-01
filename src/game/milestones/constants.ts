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

/** Starting set - numbers are a first pass, easy to retune. RESIDENTIAL/
 * COMMERCIAL/INDUSTRIAL/ROAD/POWER_PLANT/POWER_LINE are all available from
 * the start (a real city needs shops and jobs from day one, not after a
 * population milestone) - the four civic services (fire/police/hospital/
 * school) are what's gated behind progression instead. */
export const MILESTONES: Milestone[] = [
  {
    id: 'pop-10',
    title: 'Reach 10 residents',
    condition: { type: 'population', atLeast: 10 },
    reward: { type: 'cash', amount: 2000 },
  },
  {
    id: 'pop-15',
    title: 'Reach 15 residents',
    condition: { type: 'population', atLeast: 15 },
    reward: { type: 'unlockTool', toolId: BUILDING_TYPE.FIRE_STATION },
  },
  {
    id: 'pop-25',
    title: 'Reach 25 residents',
    condition: { type: 'population', atLeast: 25 },
    reward: { type: 'unlockTool', toolId: BUILDING_TYPE.POLICE_STATION },
  },
  {
    id: 'pop-40',
    title: 'Reach 40 residents',
    condition: { type: 'population', atLeast: 40 },
    reward: { type: 'unlockTool', toolId: BUILDING_TYPE.HOSPITAL },
  },
  {
    id: 'pop-60',
    title: 'Reach 60 residents',
    condition: { type: 'population', atLeast: 60 },
    reward: { type: 'unlockTool', toolId: BUILDING_TYPE.SCHOOL },
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
  const formatType = (value: string): string =>
    value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  switch (reward.type) {
    case 'cash':
      return `$${reward.amount.toLocaleString()} bonus`;
    case 'upkeepDiscount':
      return `${Math.round((1 - reward.multiplier) * 100)}% upkeep discount`;
    case 'zoneLevelCap':
      return `${formatType(reward.zoneType)} zones can reach level ${reward.newCap}`;
    case 'unlockTool':
      return `Unlocks ${formatType(reward.toolId)}`;
  }
}
