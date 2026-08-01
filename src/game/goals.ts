import { BuildingType } from '../city/building/constants';
import { GoalProgressUiState, GoalsUiState } from '../ui/store';
import { IMilestoneTracker } from './milestones';
import {
  describeReward,
  MilestoneCondition,
  MILESTONES,
} from './milestones/constants';

const ZONE_LABELS: Partial<Record<BuildingType, string>> = {
  COMMERCIAL: 'commercial zones',
  INDUSTRIAL: 'industrial zones',
  RESIDENTIAL: 'residential zones',
};

function createProgress(
  condition: MilestoneCondition,
  tracker: IMilestoneTracker
): GoalProgressUiState {
  const current = tracker.getConditionProgress(condition);

  switch (condition.type) {
    case 'population':
      return {
        current,
        target: condition.atLeast,
        kind: 'population',
        unit: 'residents',
      };
    case 'money':
      return {
        current,
        target: condition.atLeast,
        kind: 'money',
        unit: 'city funds',
      };
    case 'developedZoneCount':
      return {
        current,
        target: condition.atLeast,
        kind: 'zones',
        unit: ZONE_LABELS[condition.zoneType] ?? 'developed zones',
      };
  }
}

export function createGoalsUiState(tracker: IMilestoneTracker): GoalsUiState {
  const currentId = tracker.nextMilestone?.id ?? null;
  const completedCount = MILESTONES.filter((milestone) =>
    tracker.isCompleted(milestone.id)
  ).length;

  return {
    completedCount,
    totalCount: MILESTONES.length,
    milestones: MILESTONES.map((milestone) => {
      const completed = tracker.isCompleted(milestone.id);
      const current = milestone.id === currentId;
      return {
        id: milestone.id,
        title: milestone.title,
        reward: describeReward(milestone.reward),
        status: completed ? 'completed' : current ? 'current' : 'upcoming',
        progress: current ? createProgress(milestone.condition, tracker) : null,
      };
    }),
  };
}
