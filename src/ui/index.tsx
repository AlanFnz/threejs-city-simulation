import { useEffect, useRef, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { ControlsLegend } from './ControlsLegend';
import { CityMap } from './CityMap';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { NotificationCenter } from './NotificationCenter';
import { SimulationStatus } from './SimulationStatus';
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
  const restoreButton = useRef<HTMLButtonElement>(null);
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );

  useEffect(() => {
    if (state.isHudHidden) {
      restoreButton.current?.focus();
    }
  }, [state.isHudHidden]);

  return (
    <>
      <div
        id="hud-shell"
        className={state.isHudHidden ? 'hud-hidden' : undefined}
        aria-hidden={state.isHudHidden}
      >
        <TopBar
          cityName={state.cityName}
          simulationDay={state.simulationDay}
          money={state.money}
          income={state.income}
          upkeep={state.upkeep}
          netIncome={state.netIncome}
          population={state.population}
          census={state.census}
          activity={state.activity}
          unreadActivityCount={state.unreadActivityCount}
          isPaused={state.isPaused}
          simulationSpeed={state.simulationSpeed}
          onRenameCity={actions.renameCity}
          onSave={actions.saveGame}
          onLoad={actions.loadGame}
          onNewGame={actions.newGame}
          onActivityRead={store.markActivityRead}
          onHideHud={store.toggleHudVisibility}
        />
        <ToolBar
          activeToolId={state.activeToolId}
          money={state.money}
          isPaused={state.isPaused}
          simulationSpeed={state.simulationSpeed}
          unlockedToolIds={state.unlockedToolIds}
          hasOpenInspector={state.inspector !== null}
          onSelectTool={actions.selectTool}
          onCloseInspector={actions.closeInspector}
          onTogglePause={actions.togglePause}
          onSetSimulationSpeed={actions.setSimulationSpeed}
          onCycleSimulationSpeed={actions.cycleSimulationSpeed}
          onToggleHud={store.toggleHudVisibility}
        />
        <GoalsPanel goals={state.goals} />
        <SimulationStatus isPaused={state.isPaused} />
        <InfoPanel
          inspector={state.inspector}
          onBulldoze={actions.bulldozeFocusedTile}
          onClose={actions.closeInspector}
        />
        <NotificationCenter
          notification={state.notification}
          onDismiss={store.dismissNotification}
        />
        <ZoneCapacityPanel
          capacity={state.zoneCapacity}
          services={state.cityServices}
        />
        <div id="ui-lower-left-overlay">
          <CityMap
            map={state.cityMap}
            focus={state.cityMapFocus}
            onFocusTile={actions.focusMapTile}
          />
          <ControlsLegend />
        </div>
        {state.debugText && <div id="debug-tick">{state.debugText}</div>}
      </div>
      {state.isHudHidden && (
        <button
          ref={restoreButton}
          id="hud-restore-button"
          type="button"
          aria-label="Show city interface"
          aria-keyshortcuts="H"
          onClick={store.toggleHudVisibility}
        >
          <kbd>H</kbd>
          Show HUD
        </button>
      )}
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
