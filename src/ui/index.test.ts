import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlsLegend } from './ControlsLegend';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { NotificationCenter } from './NotificationCenter';
import { ToolBar } from './ToolBar';
import { TopBar } from './TopBar';
import { BudgetPanel } from './TopBar/BudgetPanel';
import { TOOLBAR_BUTTONS } from './constants';
import {
  createUiStore,
  GoalsUiState,
  InspectorUiState,
  UiState,
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
          money: 10000,
          income: 138,
          upkeep: 12.5,
          netIncome: 125.5,
          population: 12,
          onSave: noop,
          onLoad: noop,
          onNewGame: noop,
        })
      ),
      renderToStaticMarkup(
        createElement(ToolBar, {
          activeToolId: TOOLBAR_BUTTONS.SELECT.id,
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
    ].join('');

    expect(markup).toContain('id="ui-topbar"');
    expect(markup).toContain('id="money-counter"');
    expect(markup).toContain('id="city-budget-button"');
    expect(markup).toContain('id="net-income-counter"');
    expect(markup).toContain('+$125.5 / tick');
    expect(markup).toContain('id="population-counter"');
    expect(markup).toContain('id="city-menu-button"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('id="ui-toolbar"');
    expect(markup).toContain('id="goals-overlay-details"');
    expect(markup).toContain('id="info-panel"');
    expect(markup).toContain('id="controls-legend"');
    expect(markup).toContain('Ctrl + right drag');
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

  it('renders every tool and preserves locked state at mount time', () => {
    const markup = renderToStaticMarkup(
      createElement(ToolBar, {
        activeToolId: TOOLBAR_BUTTONS.SELECT.id,
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
  });
});

describe('UI store', () => {
  const initialState: UiState = {
    money: 10000,
    income: 0,
    upkeep: 0,
    netIncome: 0,
    population: 0,
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
