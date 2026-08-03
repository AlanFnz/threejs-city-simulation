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
  activeToolId: string | null;
  unlockedToolIds: string[];
  onSelectTool(toolId: string): void;
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

const SERVICE_TOOLS: Record<CityServiceMetricUiState['id'], string> = {
  road: 'ROAD',
  power: 'POWER_LINE',
  fire: 'FIRE_STATION',
  police: 'POLICE_STATION',
  health: 'HOSPITAL',
  education: 'SCHOOL',
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

function ServiceMetric({
  metric,
  isActive,
  isUnlocked,
  onSelect,
}: {
  metric: CityServiceMetricUiState;
  isActive: boolean;
  isUnlocked: boolean;
  onSelect(): void;
}) {
  const label = SERVICE_LABELS[metric.id];
  const coverageLabel =
    metric.percentage === null
      ? 'no developed zones'
      : `${metric.percentage}%`;
  const coverageClass =
    metric.percentage === null
      ? 'empty'
      : metric.percentage >= 80
        ? 'good'
        : metric.percentage >= 50
          ? 'watch'
          : 'poor';

  return (
    <button
      type="button"
      className={`service-metric ${coverageClass}${isActive ? ' active' : ''}`}
      aria-label={`${label} coverage: ${coverageLabel}. ${
        isUnlocked ? `Select ${label} build tool` : `${label} build tool locked`
      }`}
      aria-pressed={isActive}
      disabled={!isUnlocked}
      title={
        isUnlocked
          ? `Select ${label} build tool`
          : `${label} service unlocks through milestones`
      }
      onClick={onSelect}
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
    </button>
  );
}

function ZoneCapacityPanel({
  capacity,
  services,
  activeToolId,
  unlockedToolIds,
  onSelectTool,
}: ZoneCapacityPanelProps) {
  const disclosure = useDisclosurePreference('city-overview');
  const coverageSummary = getServiceCoverageSummary(services);

  const renderServiceMetric = (metric: CityServiceMetricUiState) => {
    const toolId = SERVICE_TOOLS[metric.id];
    return (
      <ServiceMetric
        key={metric.id}
        metric={metric}
        isActive={activeToolId === toolId}
        isUnlocked={unlockedToolIds.includes(toolId)}
        onSelect={() => onSelectTool(toolId)}
      />
    );
  };

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
          {renderServiceMetric(services.road)}
          {renderServiceMetric(services.power)}
          {renderServiceMetric(services.fire)}
          {renderServiceMetric(services.police)}
          {renderServiceMetric(services.health)}
          {renderServiceMetric(services.education)}
        </div>
      </details>
    </aside>
  );
}

export { getServiceCoverageSummary, ZoneCapacityPanel };
