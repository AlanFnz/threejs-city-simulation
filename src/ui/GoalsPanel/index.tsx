import { GoalProgressUiState, GoalsUiState } from '../store';

interface GoalsPanelProps {
  goals: GoalsUiState;
}

function formatProgressValue(progress: GoalProgressUiState): string {
  const format = (value: number) => Math.floor(value).toLocaleString();
  if (progress.kind === 'money') {
    return `$${format(progress.current)} / $${format(progress.target)}`;
  }
  return `${format(progress.current)} / ${format(progress.target)} ${progress.unit}`;
}

function GoalsPanel({ goals }: GoalsPanelProps) {
  const current = goals.milestones.find(
    (milestone) => milestone.status === 'current'
  );
  const upcoming = goals.milestones
    .filter((milestone) => milestone.status === 'upcoming')
    .slice(0, 3);
  const currentStage = current
    ? goals.milestones.findIndex((milestone) => milestone.id === current.id) + 1
    : goals.totalCount;
  const progressPercent = current?.progress
    ? Math.min(
        100,
        Math.max(0, (current.progress.current / current.progress.target) * 100)
      )
    : 100;

  return (
    <div id="ui-goals-overlay">
      <section id="goals-panel" className="hud-panel" aria-label="City goals">
        <header className="panel-heading goals-heading">
          <div>
            <span className="panel-eyebrow">City progression</span>
            <h2>Milestones</h2>
          </div>
          <span className="goal-stage-badge">
            {currentStage} / {goals.totalCount}
          </span>
        </header>
        <div id="goals-overlay-details">
          <div className="goals-overall-progress">
            <span>
              <strong>{goals.completedCount}</strong> complete
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

          {current && current.progress ? (
            <article className="current-goal-card">
              <span className="goal-card-label">Active objective</span>
              <h3>{current.title}</h3>
              <div className="current-goal-progress-copy">
                <span>{current.progress.unit}</span>
                <strong>{formatProgressValue(current.progress)}</strong>
              </div>
              <div
                className="current-goal-track"
                role="progressbar"
                aria-label={current.title}
                aria-valuemin={0}
                aria-valuemax={current.progress.target}
                aria-valuenow={Math.max(
                  0,
                  Math.min(current.progress.current, current.progress.target)
                )}
              >
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="goal-reward-card">
                <span className="reward-icon" aria-hidden="true">
                  ◆
                </span>
                <span>
                  <small>Completion reward</small>
                  <strong>{current.reward}</strong>
                </span>
              </div>
            </article>
          ) : (
            <div className="goals-complete-card">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>City vision complete</strong>
                <p>Every milestone has been achieved.</p>
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="goal-roadmap">
              <span className="goal-card-label">On the horizon</span>
              <ol>
                {upcoming.map((milestone) => {
                  const stage =
                    goals.milestones.findIndex(
                      (candidate) => candidate.id === milestone.id
                    ) + 1;
                  return (
                    <li key={milestone.id}>
                      <span className="roadmap-stage">{stage}</span>
                      <span>
                        <strong>{milestone.title}</strong>
                        <small>{milestone.reward}</small>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export { GoalsPanel };
