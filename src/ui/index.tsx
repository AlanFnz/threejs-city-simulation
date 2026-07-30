import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { ToolBar } from './ToolBar';
import { TopBar } from './TopBar';
import {
  createUiStore,
  UiActions,
  UiController,
  UiState,
} from './store';

let uiRoot: Root | null = null;

interface UiProps {
  actions: UiActions;
  store: UiController;
}

function Ui({ actions, store }: UiProps) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );

  return (
    <>
      <TopBar
        money={state.money}
        population={state.population}
        onSave={actions.saveGame}
        onLoad={actions.loadGame}
        onNewGame={actions.newGame}
      />
      <ToolBar
        activeToolId={state.activeToolId}
        isPaused={state.isPaused}
        unlockedToolIds={state.unlockedToolIds}
        onSelectTool={actions.selectTool}
        onTogglePause={actions.togglePause}
      />
      <GoalsPanel goals={state.goals} />
      <InfoPanel html={state.infoHtml} />
      <div
        id="event-toast"
        className={state.toastMessage ? 'visible' : undefined}
        role="status"
        aria-live="polite"
      >
        {state.toastMessage}
      </div>
      <div id="debug-tick">{state.debugText}</div>
    </>
  );
}

export function createUi(
  initialState: UiState,
  actions: UiActions
): UiController {
  const store = createUiStore(initialState);
  const container = document.getElementById('ui-root');
  if (!container) {
    console.error('UI root element not found!');
    return store;
  }

  uiRoot ??= createRoot(container);

  flushSync(() => {
    uiRoot?.render(<Ui actions={actions} store={store} />);
  });

  return store;
}
