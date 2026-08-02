import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlsLegend } from './ControlsLegend';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { NotificationCenter } from './NotificationCenter';
import { ToolBar } from './ToolBar';
import { TopBar } from './TopBar';
import { ZoneCapacityPanel } from './ZoneCapacityPanel';
import { BudgetPanel } from './TopBar/BudgetPanel';
import { PopulationPanel } from './TopBar/PopulationPanel';
import { TOOLBAR_BUTTONS } from './constants';
import {
  createUiStore,
  CensusUiState,
  GoalsUiState,
  InspectorUiState,
  UiState,
  ZoneCapacityUiState,
} from './store';

afterEach(() => {
  vi.useRealTimers();
});

const goals: GoalsUiState = {
  completedCount: 0,
  totalCount: 8,
  milestones: [
    {
      id: 'pop-10',
      title: 'Reach 10 residents',
      reward: '$2,000 bonus',
      status: 'current',
      progress: {
        current: 4,
        target: 10,
        kind: 'population',
        unit: 'residents',
      },
    },
    {
      id: 'pop-15',
      title: 'Reach 15 residents',
      reward: 'Unlocks Fire Station',
      status: 'upcoming',
      progress: null,
    },
  ],
};

const noop = () => undefined;

const census: CensusUiState = {
  total: 12,
  employed: 6,
  unemployed: 2,
  students: 3,
  retired: 1,
  employmentRate: 75,
};

const zoneCapacity: ZoneCapacityUiState = {
  residential: {
    id: 'residential',
    occupied: 8,
    capacity: 12,
    utilization: 67,
  },
  commercial: {
    id: 'commercial',
    occupied: 4,
    capacity: 8,
    utilization: 50,
  },
  industrial: {
    id: 'industrial',
    occupied: 0,
    capacity: 0,
    utilization: null,
  },
};

const inspector: InspectorUiState = {
  x: 4,
  y: 7,
  terrain: 'ground',
  services: [
    { id: 'road', label: 'Road', available: true },
    { id: 'power', label: 'Power', available: false },
  ],
  building: {
    type: 'RESIDENTIAL',
    title: 'Residential zone',
    category: 'Residential zone',
    state: 'developed',
    level: 2,
    maximumLevel: 3,
    buildCost: 100,
    upkeep: null,
    roadStyle: null,
    powerLoad: null,
    powerCapacity: null,
    occupancy: {
      label: 'Residents',
      current: 1,
      maximum: 4,
      people: [
        {
          id: 'citizen-1',
          name: '<img src=x onerror=alert(1)>',
          age: 31,
          status: 'employed',
        },
      ],
    },
  },
};

describe('React UI shell', () => {
  it('keeps the DOM ids used by Game for status and panel updates', () => {
    const markup = [
      renderToStaticMarkup(
        createElement(TopBar, {
          cityName: 'Harbor Heights',
          simulationDay: 27,
          money: 10000,
          income: 138,
          upkeep: 12.5,
          netIncome: 125.5,
          population: 12,
          census,
          isPaused: false,
          simulationSpeed: 2,
          onRenameCity: noop,
          onSave: noop,
          onLoad: noop,
          onNewGame: noop,
        })
      ),
      renderToStaticMarkup(
        createElement(ToolBar, {
          activeToolId: TOOLBAR_BUTTONS.SELECT.id,
          money: 10000,
          isPaused: false,
          simulationSpeed: 1,
          unlockedToolIds: Object.values(TOOLBAR_BUTTONS).map(
            (button) => button.id
          ),
          onSelectTool: noop,
          onTogglePause: noop,
          onCycleSimulationSpeed: noop,
        })
      ),
      renderToStaticMarkup(createElement(GoalsPanel, { goals })),
      renderToStaticMarkup(createElement(InfoPanel, { inspector: null })),
      renderToStaticMarkup(createElement(ControlsLegend)),
      renderToStaticMarkup(
        createElement(ZoneCapacityPanel, { capacity: zoneCapacity })
      ),
    ].join('');

    expect(markup).toContain('id="ui-topbar"');
    expect(markup).toContain('id="money-counter"');
    expect(markup).toContain('id="city-budget-button"');
    expect(markup).toContain('id="net-income-counter"');
    expect(markup).toContain('+$125.5 / tick');
    expect(markup).toContain('id="population-counter"');
    expect(markup).toContain('id="city-population-button"');
    expect(markup).toContain('id="city-menu-button"');
    expect(markup).toContain('Harbor Heights');
    expect(markup).toContain('aria-label="Rename Harbor Heights"');
    expect(markup).toContain('Day 27');
    expect(markup).toContain('2× speed');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('id="ui-toolbar"');
    expect(markup).toContain('id="active-tool-context"');
    expect(markup).toContain('Inspect city tiles');
    expect(markup).toContain('id="goals-overlay-details"');
    expect(markup).toContain('id="info-panel"');
    expect(markup).toContain('id="controls-legend"');
    expect(markup).toContain('id="zone-capacity-panel"');
    expect(markup).toContain('Ctrl + right drag');
    expect(markup).toContain('1–9 · R · B');
  });

  it('renders typed inspector data as structured status cards', () => {
    const markup = renderToStaticMarkup(
      createElement(InfoPanel, { inspector })
    );

    expect(markup).toContain('Residential zone');
    expect(markup).toContain('4, 7');
    expect(markup).toContain('Road</span><strong>Online');
    expect(markup).toContain('Power</span><strong>Missing');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(markup).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('renders live milestone progress and the upcoming roadmap', () => {
    const markup = renderToStaticMarkup(createElement(GoalsPanel, { goals }));

    expect(markup).toContain('Active objective');
    expect(markup).toContain('4 / 10 residents');
    expect(markup).toContain('aria-valuenow="4"');
    expect(markup).toContain('Reach 15 residents');
    expect(markup).toContain('1 / 8');
  });

  it('renders typed notification tone, title, and detail', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationCenter, {
        notification: {
          id: 1,
          tone: 'milestone',
          title: 'Milestone complete',
          message: 'Reach 10 residents · $2,000 bonus',
        },
      })
    );

    expect(markup).toContain('tone-milestone');
    expect(markup).toContain('Milestone complete');
    expect(markup).toContain('Reach 10 residents · $2,000 bonus');
  });

  it('renders a typed city budget breakdown', () => {
    const markup = renderToStaticMarkup(
      createElement(BudgetPanel, {
        money: 9825,
        income: 40,
        upkeep: 15.5,
        netIncome: 24.5,
      })
    );

    expect(markup).toContain('City budget overview');
    expect(markup).toContain('Tax revenue');
    expect(markup).toContain('+$40');
    expect(markup).toContain('−$15.5');
    expect(markup).toContain('+$24.5 / tick');
  });

  it('renders a typed city census breakdown', () => {
    const markup = renderToStaticMarkup(
      createElement(PopulationPanel, { census })
    );

    expect(markup).toContain('City population overview');
    expect(markup).toContain('Census overview');
    expect(markup).toContain('Employment');
    expect(markup).toContain('75%');
    expect(markup).toContain('Job seekers');
    expect(markup).toContain('aria-valuenow="75"');
  });

  it('renders real zone capacity without inventing demand values', () => {
    const markup = renderToStaticMarkup(
      createElement(ZoneCapacityPanel, { capacity: zoneCapacity })
    );

    expect(markup).toContain('City zone capacity');
    expect(markup).toContain('Residential');
    expect(markup).toContain('8 / 12');
    expect(markup).toContain('aria-valuenow="67"');
    expect(markup).toContain('No active zones');
  });

  it('renders every tool and preserves locked state at mount time', () => {
    const markup = renderToStaticMarkup(
      createElement(ToolBar, {
        activeToolId: TOOLBAR_BUTTONS.SELECT.id,
        money: 10000,
        isPaused: false,
        simulationSpeed: 2,
        unlockedToolIds: [
          TOOLBAR_BUTTONS.SELECT.id,
          TOOLBAR_BUTTONS.RESIDENTIAL.id,
        ],
        onSelectTool: noop,
        onTogglePause: noop,
        onCycleSimulationSpeed: noop,
      })
    );

    for (const button of Object.values(TOOLBAR_BUTTONS)) {
      expect(markup).toContain(`id="${button.id}"`);
      expect(markup).toContain(`data-type="${button.id}"`);
    }
    expect(markup).toContain('id="RESIDENTIAL" class="tool-option"');
    expect(markup).toContain('id="FIRE_STATION" class="tool-option locked"');
    expect(markup).toContain('id="SELECT" class="ui-button selected"');
    expect(markup).toContain('aria-label="Zones tools"');
    expect(markup).toContain('id="simulation-speed-button"');
    expect(markup).toContain('Currently 2 times');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('$100');
    expect(markup).toContain('15 residents');
    expect(markup).toContain('aria-keyshortcuts="Escape"');
    expect(markup).toContain('aria-keyshortcuts="1"');
    expect(markup).toContain('aria-keyshortcuts="Space"');
  });

  it('shows selected placement cost and insufficient-funds context', () => {
    const markup = renderToStaticMarkup(
      createElement(ToolBar, {
        activeToolId: TOOLBAR_BUTTONS.ROAD.id,
        money: 0,
        isPaused: false,
        simulationSpeed: 1,
        unlockedToolIds: [TOOLBAR_BUTTONS.ROAD.id],
        onSelectTool: noop,
        onTogglePause: noop,
        onCycleSimulationSpeed: noop,
      })
    );

    expect(markup).toContain('active-tool-context insufficient-funds');
    expect(markup).toContain('ROAD');
    expect(markup).toContain('Click or drag to place');
    expect(markup).toContain('$10 more needed');
  });
});

describe('UI store', () => {
  const initialState: UiState = {
    cityName: 'My City',
    simulationDay: 1,
    money: 10000,
    income: 0,
    upkeep: 0,
    netIncome: 0,
    population: 0,
    census: {
      total: 0,
      employed: 0,
      unemployed: 0,
      students: 0,
      retired: 0,
      employmentRate: null,
    },
    zoneCapacity: {
      residential: { ...zoneCapacity.residential, occupied: 0 },
      commercial: { ...zoneCapacity.commercial, occupied: 0 },
      industrial: { ...zoneCapacity.industrial },
    },
    activeToolId: 'SELECT',
    isPaused: false,
    simulationSpeed: 1,
    unlockedToolIds: ['SELECT'],
    inspector: null,
    goals,
    notification: null,
    debugText: '',
  };

  it('publishes immutable snapshots to subscribers', () => {
    const store = createUiStore(initialState);
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ population: 4, activeToolId: 'ROAD' });

    expect(store.getSnapshot()).not.toBe(initialState);
    expect(store.getSnapshot()).toMatchObject({
      population: 4,
      activeToolId: 'ROAD',
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('replaces and automatically clears typed notifications', () => {
    vi.useFakeTimers();
    const store = createUiStore(initialState);

    store.showNotification({
      tone: 'success',
      title: 'City saved',
      message: 'Progress stored locally',
    });
    expect(store.getSnapshot().notification).toMatchObject({
      id: 1,
      tone: 'success',
      title: 'City saved',
    });

    vi.advanceTimersByTime(4500);
    expect(store.getSnapshot().notification).toBeNull();
  });
});
