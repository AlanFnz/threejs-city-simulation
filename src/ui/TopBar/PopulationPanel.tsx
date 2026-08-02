import type { CensusUiState } from '../store';

interface PopulationPanelProps {
  census: CensusUiState;
}

function PopulationPanel({ census }: PopulationPanelProps) {
  const employmentRate = census.employmentRate ?? 0;

  return (
    <div
      id="city-population-panel"
      className="city-population-panel"
      role="dialog"
      aria-label="City population overview"
    >
      <header>
        <span>
          <small>City population</small>
          <strong>Census overview</strong>
        </span>
        <span className="census-total">
          <small>Residents</small>
          <strong>{census.total.toLocaleString()}</strong>
        </span>
      </header>
      <div className="census-content">
        <div className="census-employment">
          <span>
            <small>Employment</small>
            <strong>
              {census.employmentRate === null
                ? 'No workforce'
                : `${census.employmentRate}%`}
            </strong>
          </span>
          <div
            className="census-progress"
            role="progressbar"
            aria-label="Employment rate"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={employmentRate}
          >
            <span style={{ width: `${employmentRate}%` }} />
          </div>
        </div>
        <div className="census-grid">
          <div className="census-stat employed">
            <span aria-hidden="true">●</span>
            <small>Employed</small>
            <strong>{census.employed.toLocaleString()}</strong>
          </div>
          <div className="census-stat unemployed">
            <span aria-hidden="true">●</span>
            <small>Job seekers</small>
            <strong>{census.unemployed.toLocaleString()}</strong>
          </div>
          <div className="census-stat students">
            <span aria-hidden="true">●</span>
            <small>Students</small>
            <strong>{census.students.toLocaleString()}</strong>
          </div>
          <div className="census-stat retired">
            <span aria-hidden="true">●</span>
            <small>Retired</small>
            <strong>{census.retired.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export { PopulationPanel };
