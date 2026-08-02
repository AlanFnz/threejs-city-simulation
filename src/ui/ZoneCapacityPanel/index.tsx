import type {
  ZoneCapacityMetricUiState,
  ZoneCapacityUiState,
} from '../store';

interface ZoneCapacityPanelProps {
  capacity: ZoneCapacityUiState;
}

const LABELS: Record<ZoneCapacityMetricUiState['id'], string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

function CapacityRow({ metric }: { metric: ZoneCapacityMetricUiState }) {
  const utilization = metric.utilization ?? 0;
  const label = LABELS[metric.id];

  return (
    <div className={`capacity-row ${metric.id}`}>
      <span className="capacity-label">
        <i aria-hidden="true" />
        {label}
      </span>
      <span className="capacity-value">
        {metric.capacity === 0
          ? 'No active zones'
          : `${metric.occupied.toLocaleString()} / ${metric.capacity.toLocaleString()}`}
      </span>
      <div
        className="capacity-progress"
        role="progressbar"
        aria-label={`${label} capacity utilization`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={utilization}
      >
        <span style={{ width: `${utilization}%` }} />
      </div>
    </div>
  );
}

function ZoneCapacityPanel({ capacity }: ZoneCapacityPanelProps) {
  return (
    <aside id="zone-capacity-panel" aria-label="City zone capacity">
      <header>
        <span className="panel-eyebrow">City utilization</span>
        <strong>Zone capacity</strong>
      </header>
      <div className="capacity-rows">
        <CapacityRow metric={capacity.residential} />
        <CapacityRow metric={capacity.commercial} />
        <CapacityRow metric={capacity.industrial} />
      </div>
    </aside>
  );
}

export { ZoneCapacityPanel };
