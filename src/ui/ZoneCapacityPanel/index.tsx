import type {
  CityServiceMetricUiState,
  CityServicesUiState,
  ZoneCapacityMetricUiState,
  ZoneCapacityUiState,
} from '../store';
import { getIcon, ICON_KEYS, type IconKey } from '../../assetManager/icons';
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

const SERVICE_ICONS: Record<CityServiceMetricUiState['id'], IconKey> = {
  road: ICON_KEYS.ROAD_COLOR,
  power: ICON_KEYS.POWER_COLOR,
  fire: ICON_KEYS.FIRE_STATION_COLOR,
  police: ICON_KEYS.POLICE_STATION_COLOR,
  health: ICON_KEYS.HOSPITAL_COLOR,
  education: ICON_KEYS.SCHOOL_COLOR,
};

interface CoverageSummary {
  label: string;
  ariaLabel: string;
  tone: 'empty' | 'good' | 'watch' | 'poor';
}

function getServiceCoverageSummary(
  services: CityServicesUiState
): CoverageSummary {
  const activeMetrics = Object.values(services).filter(
    (metric) => metric.percentage !== null
  );
  if (activeMetrics.length === 0) {
    return {
      label: 'No zones',
      ariaLabel: 'No developed zones to evaluate',
      tone: 'empty',
    };
  }

  const gaps = activeMetrics.filter((metric) => (metric.percentage ?? 0) < 80);
  if (gaps.length === 0) {
    return {
      label: 'All covered',
      ariaLabel: 'All active city services have healthy coverage',
      tone: 'good',
    };
  }

  const hasPoorCoverage = gaps.some(
    (metric) => (metric.percentage ?? 0) < 50
  );
  return {
    label: `${gaps.length} ${gaps.length === 1 ? 'gap' : 'gaps'}`,
    ariaLabel: `${gaps.length} city service coverage ${
      gaps.length === 1 ? 'gap' : 'gaps'
    }`,
    tone: hasPoorCoverage ? 'poor' : 'watch',
  };
}

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
  const label = SERVICE_LABELS[metric.id];
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
      aria-label={`${label} coverage: ${
        metric.percentage === null ? 'no developed zones' : `${metric.percentage}%`
      }`}
    >
      <img src={getIcon(SERVICE_ICONS[metric.id])} alt="" aria-hidden="true" />
      <span className="service-metric-copy">
        <span>{label}</span>
        <small>
          {metric.total === 0
            ? 'No active zones'
            : `${metric.covered} / ${metric.total} zones`}
        </small>
      </span>
      <strong>
        {metric.percentage === null ? '—' : `${metric.percentage}%`}
      </strong>
    </div>
  );
}

function ZoneCapacityPanel({ capacity, services }: ZoneCapacityPanelProps) {
  const disclosure = useDisclosurePreference('city-overview');
  const coverageSummary = getServiceCoverageSummary(services);

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
          <span className="zone-capacity-heading-meta">
            <span
              className={`coverage-summary ${coverageSummary.tone}`}
              aria-label={coverageSummary.ariaLabel}
            >
              {coverageSummary.label}
            </span>
            <span className="panel-collapse-indicator" aria-hidden="true" />
          </span>
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

export { getServiceCoverageSummary, ZoneCapacityPanel };
