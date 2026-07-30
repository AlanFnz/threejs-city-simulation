import { GoalsUiState } from '../store';

interface GoalsPanelProps {
  goals: GoalsUiState;
}

function GoalsPanel({ goals }: GoalsPanelProps) {
  return (
    <div id="ui-goals-overlay">
      <div id="goals-panel">
        <div className="info-heading">
          <span>GOALS</span>
        </div>
        <div id="goals-overlay-details">
          <div className="goals-line">
            {goals.completedCount}/{goals.totalCount} completed
          </div>
          {goals.nextTitle ? (
            <>
              <div className="goals-line">Next: {goals.nextTitle}</div>
              <div className="goals-line goals-reward">
                {goals.nextReward}
              </div>
            </>
          ) : (
            <div className="goals-line">All goals complete!</div>
          )}
        </div>
      </div>
    </div>
  );
}

export { GoalsPanel };
