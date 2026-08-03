import type {
  CityServiceMetricUiState,
  CityServicesUiState,
  ZoneCapacityMetricUiState,
  ZoneCapacityUiState,
} from '../store';
import { useDisclosurePreference } from '../disclosurePreferences';

interface ZoneCapacityPanelProps {
  capacity: ZoneCapacityUiState;
  services: CityServicesUiState;
}

const LABELS: Record<ZoneCapacityMetricUiState['id'], string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

const SERVICE_LABELS: Record<CityServiceMetricUiState['id'], string> = {
  road: 'Road',
  power: 'Power',
  fire: 'Fire',
  police: 'Police',
  health: 'Health',
  education: 'Education',
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

function ServiceMetric({ metric }: { metric: CityServiceMetricUiState }) {
  const coverageClass =
    metric.percentage === null
      ? 'empty'
      : metric.percentage >= 80
        ? 'good'
        : metric.percentage >= 50
          ? 'watch'
          : 'poor';

  return (
    <div
      className={`service-metric ${coverageClass}`}
      aria-label={`${SERVICE_LABELS[metric.id]} coverage: ${
        metric.percentage === null ? 'no developed zones' : `${metric.percentage}%`
      }`}
    >
      <span>{SERVICE_LABELS[metric.id]}</span>
      <strong>{metric.percentage === null ? '—' : `${metric.percentage}%`}</strong>
    </div>
  );
}

function ZoneCapacityPanel({ capacity, services }: ZoneCapacityPanelProps) {
  const disclosure = useDisclosurePreference('city-overview');

  return (
    <aside
      id="zone-capacity-panel"
      aria-label="City capacity and service coverage"
    >
      <details open={disclosure.isOpen} onToggle={disclosure.onToggle}>
        <summary className="zone-capacity-heading">
          <span>
            <span className="panel-eyebrow">City utilization</span>
            <strong>Zone capacity</strong>
          </span>
          <span className="panel-collapse-indicator" aria-hidden="true" />
        </summary>
        <div className="capacity-rows">
          <CapacityRow metric={capacity.residential} />
          <CapacityRow metric={capacity.commercial} />
          <CapacityRow metric={capacity.industrial} />
        </div>
        <div className="service-coverage-heading">
          <span>Developed zone coverage</span>
          <small>City services</small>
        </div>
        <div className="service-coverage-grid">
          <ServiceMetric metric={services.road} />
          <ServiceMetric metric={services.power} />
          <ServiceMetric metric={services.fire} />
          <ServiceMetric metric={services.police} />
          <ServiceMetric metric={services.health} />
          <ServiceMetric metric={services.education} />
        </div>
      </details>
    </aside>
  );
}

export { ZoneCapacityPanel };
