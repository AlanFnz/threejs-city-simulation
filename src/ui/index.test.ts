import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { ToolBar } from './ToolBar';
import { TopBar } from './TopBar';
import { TOOLBAR_BUTTONS } from './constants';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('React UI compatibility shell', () => {
  it('keeps the DOM ids used by Game for status and panel updates', () => {
    vi.stubGlobal('window', {
      game: {
        isPaused: false,
      },
    });

    const markup = [
      renderToStaticMarkup(createElement(TopBar)),
      renderToStaticMarkup(
        createElement(ToolBar, { isUnlocked: () => true })
      ),
      renderToStaticMarkup(createElement(GoalsPanel)),
      renderToStaticMarkup(createElement(InfoPanel)),
    ].join('');

    expect(markup).toContain('id="ui-topbar"');
    expect(markup).toContain('id="money-counter"');
    expect(markup).toContain('id="population-counter"');
    expect(markup).toContain('id="ui-toolbar"');
    expect(markup).toContain('id="goals-overlay-details"');
    expect(markup).toContain('id="info-overlay-details"');
  });

  it('renders every tool and preserves locked state at mount time', () => {
    vi.stubGlobal('window', {
      game: {
        isPaused: false,
      },
    });

    const markup = renderToStaticMarkup(
      createElement(ToolBar, {
        isUnlocked: (toolId: string) => toolId === TOOLBAR_BUTTONS.SELECT.id,
      })
    );

    for (const button of Object.values(TOOLBAR_BUTTONS)) {
      expect(markup).toContain(`id="${button.id}"`);
      expect(markup).toContain(`data-type="${button.id}"`);
    }
    expect(markup).toContain('id="RESIDENTIAL" class="ui-button locked"');
  });
});
