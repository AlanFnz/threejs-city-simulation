import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { ControlsLegend } from './ControlsLegend';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { NotificationCenter } from './NotificationCenter';
import { ToolBar } from './ToolBar';
import { TopBar } from './TopBar';
import { ZoneCapacityPanel } from './ZoneCapacityPanel';
import { createUiStore, UiActions, UiController, UiState } from './store';

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
        cityName={state.cityName}
        simulationDay={state.simulationDay}
        money={state.money}
        income={state.income}
        upkeep={state.upkeep}
        netIncome={state.netIncome}
        population={state.population}
        census={state.census}
        isPaused={state.isPaused}
        simulationSpeed={state.simulationSpeed}
        onRenameCity={actions.renameCity}
        onSave={actions.saveGame}
        onLoad={actions.loadGame}
        onNewGame={actions.newGame}
      />
      <ToolBar
        activeToolId={state.activeToolId}
        money={state.money}
        isPaused={state.isPaused}
        simulationSpeed={state.simulationSpeed}
        unlockedToolIds={state.unlockedToolIds}
        onSelectTool={actions.selectTool}
        onTogglePause={actions.togglePause}
        onCycleSimulationSpeed={actions.cycleSimulationSpeed}
      />
      <GoalsPanel goals={state.goals} />
      <InfoPanel inspector={state.inspector} />
      <NotificationCenter notification={state.notification} />
      <ZoneCapacityPanel capacity={state.zoneCapacity} />
      <ControlsLegend />
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
