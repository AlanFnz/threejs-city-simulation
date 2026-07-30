import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { ToolBar } from './ToolBar';
import { TopBar } from './TopBar';
import { TOOLBAR_BUTTONS } from './constants';
import { createUiStore, GoalsUiState, UiState } from './store';

afterEach(() => {
  vi.useRealTimers();
});

const goals: GoalsUiState = {
  completedCount: 0,
  totalCount: 8,
  nextTitle: 'Reach 10 residents',
  nextReward: '$2000 bonus',
};

const noop = () => undefined;

describe('React UI shell', () => {
  it('keeps the DOM ids used by Game for status and panel updates', () => {
    const markup = [
      renderToStaticMarkup(
        createElement(TopBar, {
          money: 10000,
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
          unlockedToolIds: Object.values(TOOLBAR_BUTTONS).map(
            (button) => button.id
          ),
          onSelectTool: noop,
          onTogglePause: noop,
        })
      ),
      renderToStaticMarkup(createElement(GoalsPanel, { goals })),
      renderToStaticMarkup(createElement(InfoPanel, { html: null })),
    ].join('');

    expect(markup).toContain('id="ui-topbar"');
    expect(markup).toContain('id="money-counter"');
    expect(markup).toContain('id="population-counter"');
    expect(markup).toContain('id="ui-toolbar"');
    expect(markup).toContain('id="goals-overlay-details"');
    expect(markup).toContain('id="info-overlay-details"');
  });

  it('renders every tool and preserves locked state at mount time', () => {
    const markup = renderToStaticMarkup(
      createElement(ToolBar, {
        activeToolId: TOOLBAR_BUTTONS.SELECT.id,
        isPaused: false,
        unlockedToolIds: [TOOLBAR_BUTTONS.SELECT.id],
        onSelectTool: noop,
        onTogglePause: noop,
      })
    );

    for (const button of Object.values(TOOLBAR_BUTTONS)) {
      expect(markup).toContain(`id="${button.id}"`);
      expect(markup).toContain(`data-type="${button.id}"`);
    }
    expect(markup).toContain('id="RESIDENTIAL" class="ui-button locked"');
    expect(markup).toContain('id="SELECT" class="ui-button selected"');
  });
});

describe('UI store', () => {
  const initialState: UiState = {
    money: 10000,
    population: 0,
    activeToolId: 'SELECT',
    isPaused: false,
    unlockedToolIds: ['SELECT'],
    infoHtml: null,
    goals,
    toastMessage: null,
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

  it('replaces and automatically clears toast messages', () => {
    vi.useFakeTimers();
    const store = createUiStore(initialState);

    store.showToast('Milestone complete');
    expect(store.getSnapshot().toastMessage).toBe('Milestone complete');

    vi.advanceTimersByTime(4000);
    expect(store.getSnapshot().toastMessage).toBeNull();
  });
});
