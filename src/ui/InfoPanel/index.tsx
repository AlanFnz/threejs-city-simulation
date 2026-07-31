import { InspectorBuildingUiState, InspectorUiState } from '../store';

interface InfoPanelProps {
  inspector: InspectorUiState | null;
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="inspector-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BuildingCard({ building }: { building: InspectorBuildingUiState }) {
  const occupancy = building.occupancy;
  const occupancyPercent = occupancy?.maximum
    ? Math.round((occupancy.current / occupancy.maximum) * 100)
    : 0;

  return (
    <section
      className={`inspector-building type-${building.type.toLowerCase()}`}
    >
      <div className="inspector-building-title">
        <span className="inspector-building-marker" aria-hidden="true" />
        <div>
          <span>{building.category}</span>
          <h3>{building.title}</h3>
        </div>
        {building.state && (
          <span className={`status-badge state-${building.state}`}>
            {formatLabel(building.state)}
          </span>
        )}
      </div>

      <div className="inspector-metrics">
        {building.level !== null && (
          <Metric
            label="Level"
            value={`${building.level} / ${building.maximumLevel}`}
          />
        )}
        {building.buildCost !== null && (
          <Metric label="Build cost" value={`$${building.buildCost}`} />
        )}
        {building.upkeep !== null && (
          <Metric label="Upkeep" value={`$${building.upkeep}/tick`} />
        )}
        {building.roadStyle && (
          <Metric label="Junction" value={formatLabel(building.roadStyle)} />
        )}
        {building.powerLoad !== null && (
          <Metric
            label="Grid load"
            value={`${building.powerLoad} / ${building.powerCapacity}`}
          />
        )}
      </div>

      {occupancy && (
        <div className="inspector-occupancy">
          <div className="occupancy-heading">
            <span>{occupancy.label}</span>
            <strong>
              {occupancy.current} / {occupancy.maximum}
            </strong>
          </div>
          <div
            className="occupancy-track"
            role="progressbar"
            aria-label={`${occupancy.label} capacity`}
            aria-valuemin={0}
            aria-valuemax={occupancy.maximum}
            aria-valuenow={occupancy.current}
          >
            <span style={{ width: `${occupancyPercent}%` }} />
          </div>
          {occupancy.people.length > 0 ? (
            <ul className="inspector-people">
              {occupancy.people.map((person) => (
                <li key={person.id}>
                  <span className="person-avatar" aria-hidden="true">
                    {person.name.charAt(0)}
                  </span>
                  <span className="person-details">
                    <strong>{person.name}</strong>
                    <span>
                      Age {person.age} · {formatLabel(person.status)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="occupancy-empty">
              No {occupancy.label.toLowerCase()} yet
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function InfoPanel({ inspector }: InfoPanelProps) {
  return (
    <div id="ui-info-overlay">
      <aside
        id="info-panel"
        className={`hud-panel${inspector ? ' visible' : ''}`}
        aria-label="Selected tile information"
        aria-hidden={!inspector}
      >
        {inspector && (
          <>
            <header className="panel-heading inspector-heading">
              <div>
                <span className="panel-eyebrow">City inspector</span>
                <h2>{inspector.building?.title ?? 'Empty lot'}</h2>
              </div>
              <span className="coordinate-badge">
                {inspector.x}, {inspector.y}
              </span>
            </header>
            <div id="info-overlay-details">
              <section className="inspector-section">
                <div className="inspector-section-heading">
                  <h3>Local services</h3>
                  <span>{formatLabel(inspector.terrain)}</span>
                </div>
                <div className="service-grid">
                  {inspector.services.map((service) => (
                    <div
                      key={service.id}
                      className={`service-chip ${
                        service.available ? 'available' : 'unavailable'
                      }`}
                    >
                      <span className="service-indicator" aria-hidden="true" />
                      <span>{service.label}</span>
                      <strong>
                        {service.available ? 'Online' : 'Missing'}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
              {inspector.building ? (
                <BuildingCard building={inspector.building} />
              ) : (
                <div className="inspector-empty-building">
                  <span aria-hidden="true">+</span>
                  <div>
                    <strong>Ready for development</strong>
                    <p>Select a build tool to give this tile a purpose.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export { InfoPanel };
