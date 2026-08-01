import { describe, expect, it } from 'vitest';
import { IMilestoneTracker } from './milestones';
import { MilestoneCondition, MILESTONES } from './milestones/constants';
import { createGoalsUiState } from './goals';

function createTracker(
  completed: string[] = [],
  progress = 4
): IMilestoneTracker {
  return {
    isUnlocked: () => true,
    isCompleted: (id) => completed.includes(id),
    nextMilestone:
      MILESTONES.find((milestone) => !completed.includes(milestone.id)) ?? null,
    getConditionProgress: (_condition: MilestoneCondition) => progress,
    getState: () => ({ completed, unlockedToolIds: [] }),
    restoreState: () => undefined,
    dispose: () => undefined,
  };
}

describe('createGoalsUiState', () => {
  it('maps the active milestone with live progress and future stages', () => {
    const tracker = createTracker();

    const state = createGoalsUiState(tracker);

    expect(state.completedCount).toBe(0);
    expect(state.milestones[0]).toMatchObject({
      id: 'pop-10',
      status: 'current',
      reward: '$2,000 bonus',
      progress: {
        current: 4,
        target: 10,
        kind: 'population',
        unit: 'residents',
      },
    });
    expect(state.milestones[1]).toMatchObject({
      id: 'pop-15',
      status: 'upcoming',
      progress: null,
    });
  });

  it('marks every milestone complete when there is no next milestone', () => {
    const completed = [
      'pop-10',
      'pop-15',
      'pop-25',
      'pop-40',
      'pop-60',
      'money-25000',
      'commercial-5',
      'industrial-5',
    ];
    const tracker = createTracker(completed);

    const state = createGoalsUiState(tracker);

    expect(state.completedCount).toBe(state.totalCount);
    expect(
      state.milestones.every((milestone) => milestone.status === 'completed')
    ).toBe(true);
  });
});
