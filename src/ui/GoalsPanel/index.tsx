import { GoalsUiState } from '../store';

interface GoalsPanelProps {
  goals: GoalsUiState;
}

function GoalsPanel({ goals }: GoalsPanelProps) {
  return (
    <div id="ui-goals-overlay">
      <section id="goals-panel" className="hud-panel" aria-label="City goals">
        <header className="panel-heading">
          <span className="panel-eyebrow">Progress</span>
          <h2>City goals</h2>
        </header>
        <div id="goals-overlay-details">
          <div className="goals-progress" aria-label="Goal completion">
            <span>
              {goals.completedCount} of {goals.totalCount} complete
            </span>
            <span className="goals-progress-track" aria-hidden="true">
              <span
                className="goals-progress-value"
                style={{
                  width: `${(goals.completedCount / goals.totalCount) * 100}%`,
                }}
              />
            </span>
          </div>
          {goals.nextTitle ? (
            <div className="goal-card">
              <span className="goal-card-label">Next milestone</span>
              <strong>{goals.nextTitle}</strong>
              <span className="goals-reward">{goals.nextReward}</span>
            </div>
          ) : (
            <div className="goal-card goal-card-complete">
              All goals complete!
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export { GoalsPanel };
