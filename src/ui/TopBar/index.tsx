import { useEffect, useRef, useState } from 'react';
import personIcon from '../../assetManager/icons/person.png';
import { BudgetPanel } from './BudgetPanel';
import { CityName } from './CityName';
import type { SimulationSpeed } from '../../game/simulationSpeed';
import type { CensusUiState } from '../store';
import type { UiNotification } from '../store';
import { PopulationPanel } from './PopulationPanel';
import { ActivityLog } from './ActivityLog';

type OpenTopBarPanel = 'budget' | 'population' | 'menu' | null;

interface TopBarProps {
  cityName: string;
  simulationDay: number;
  money: number;
  income: number;
  upkeep: number;
  netIncome: number;
  population: number;
  census: CensusUiState;
  activity: UiNotification[];
  unreadActivityCount: number;
  isPaused: boolean;
  simulationSpeed: SimulationSpeed;
  onRenameCity: (name: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onActivityRead: () => void;
  onHideHud: () => void;
}

function TopBar({
  cityName,
  simulationDay,
  money,
  income,
  upkeep,
  netIncome,
  population,
  census,
  activity,
  unreadActivityCount,
  isPaused,
  simulationSpeed,
  onRenameCity,
  onSave,
  onLoad,
  onNewGame,
  onActivityRead,
  onHideHud,
}: TopBarProps) {
  const [openPanel, setOpenPanel] = useState<OpenTopBarPanel>(null);
  const budgetContainer = useRef<HTMLDivElement>(null);
  const budgetButton = useRef<HTMLButtonElement>(null);
  const populationContainer = useRef<HTMLDivElement>(null);
  const populationButton = useRef<HTMLButtonElement>(null);
  const menuContainer = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openPanel) return;

    const onPointerDown = (event: PointerEvent) => {
      const activeContainer =
        openPanel === 'budget'
          ? budgetContainer.current
          : openPanel === 'population'
            ? populationContainer.current
            : menuContainer.current;
      if (!activeContainer?.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenPanel(null);
      (openPanel === 'budget'
        ? budgetButton
        : openPanel === 'population'
          ? populationButton
          : menuButton
      ).current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openPanel]);

  useEffect(() => {
    if (openPanel === 'menu' && unreadActivityCount > 0) onActivityRead();
  }, [onActivityRead, openPanel, unreadActivityCount]);

  const runAction = (action: () => void) => {
    action();
    setOpenPanel(null);
  };
  const incomeTone =
    netIncome > 0 ? 'positive' : netIncome < 0 ? 'negative' : 'neutral';
  const formattedNetIncome = `${netIncome > 0 ? '+' : netIncome < 0 ? '−' : ''}$${Math.abs(
    netIncome
  ).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <header id="ui-topbar" aria-label="City status">
      <div
        id="ui-topbar-left-items"
        className="ui-topbar-items ui-topbar-left-items"
      >
        <div className="city-budget" ref={budgetContainer}>
          <button
            id="city-budget-button"
            ref={budgetButton}
            className={`hud-stat hud-stat-money budget-trigger${
              openPanel === 'budget' ? ' active' : ''
            }`}
            type="button"
            aria-label="Open city budget"
            aria-haspopup="dialog"
            aria-expanded={openPanel === 'budget'}
            aria-controls="city-budget-panel"
            onClick={() =>
              setOpenPanel((current) =>
                current === 'budget' ? null : 'budget'
              )
            }
          >
            <span className="hud-stat-icon" aria-hidden="true">
              $
            </span>
            <span className="hud-stat-copy">
              <span className="hud-stat-label">City funds</span>
              <strong
                id="money-counter"
                className={money < 0 ? 'low-funds' : undefined}
              >
                ${Math.floor(money).toLocaleString()}
              </strong>
              <small
                id="net-income-counter"
                className={`income-trend ${incomeTone}`}
                aria-label={`Net income ${formattedNetIncome} per simulation tick`}
              >
                <span aria-hidden="true">
                  {netIncome > 0 ? '▲' : netIncome < 0 ? '▼' : '—'}
                </span>
                {formattedNetIncome} / tick
              </small>
            </span>
          </button>
          {openPanel === 'budget' && (
            <BudgetPanel
              money={money}
              income={income}
              upkeep={upkeep}
              netIncome={netIncome}
            />
          )}
        </div>
      </div>

      <div
        id="ui-topbar-center-items"
        className="ui-topbar-items ui-topbar-center-items"
      >
        <CityName name={cityName} onRename={onRenameCity} />
        <span className={`city-status${isPaused ? ' paused' : ''}`}>
          <span>Day {simulationDay.toLocaleString()}</span>
          <span className="city-status-separator" aria-hidden="true">
            ·
          </span>
          <span>
            {isPaused ? 'Simulation paused' : `${simulationSpeed}× speed`}
          </span>
        </span>
      </div>

      <div
        id="ui-topbar-right-items"
        className="ui-topbar-items ui-topbar-right-items"
      >
        <div className="city-population" ref={populationContainer}>
          <button
            id="city-population-button"
            ref={populationButton}
            className={`hud-stat hud-stat-population population-trigger${
              openPanel === 'population' ? ' active' : ''
            }`}
            type="button"
            aria-label="Open city population"
            aria-haspopup="dialog"
            aria-expanded={openPanel === 'population'}
            aria-controls="city-population-panel"
            onClick={() =>
              setOpenPanel((current) =>
                current === 'population' ? null : 'population'
              )
            }
          >
            <span className="hud-stat-icon">
              <img id="population-icon" src={personIcon} alt="" />
            </span>
            <span className="hud-stat-copy">
              <span className="hud-stat-label">Population</span>
              <strong id="population-counter">
                {population.toLocaleString()}
              </strong>
            </span>
          </button>
          {openPanel === 'population' && (
            <PopulationPanel census={census} />
          )}
        </div>
        <div className="city-menu" ref={menuContainer}>
          <button
            id="city-menu-button"
            ref={menuButton}
            className={`city-menu-trigger${
              openPanel === 'menu' ? ' active' : ''
            }`}
            type="button"
            aria-label={`City management menu${
              unreadActivityCount > 0
                ? `, ${unreadActivityCount} unread activity ${
                    unreadActivityCount === 1 ? 'entry' : 'entries'
                  }`
                : ''
            }`}
            aria-expanded={openPanel === 'menu'}
            aria-controls="city-management-menu"
            onClick={() =>
              setOpenPanel((current) => (current === 'menu' ? null : 'menu'))
            }
          >
            <span className="menu-trigger-icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="menu-trigger-label">Menu</span>
            {unreadActivityCount > 0 && (
              <span className="city-menu-activity-badge" aria-hidden="true">
                {unreadActivityCount}
              </span>
            )}
          </button>
          {openPanel === 'menu' && (
            <div
              id="city-management-menu"
              className="city-management-menu"
              role="menu"
              aria-label="City management"
            >
              <header>
                <span className="panel-eyebrow">City management</span>
                <strong>Game options</strong>
              </header>
              <div className="city-menu-actions">
                <button
                  id="save-game-button"
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onSave)}
                >
                  <span className="city-menu-icon" aria-hidden="true">
                    ↓
                  </span>
                  <span>
                    <strong>Save city</strong>
                    <small>Store your current progress</small>
                  </span>
                </button>
                <button
                  id="load-game-button"
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onLoad)}
                >
                  <span className="city-menu-icon" aria-hidden="true">
                    ↻
                  </span>
                  <span>
                    <strong>Load city</strong>
                    <small>Restore your latest save</small>
                  </span>
                </button>
                <button
                  id="hide-hud-button"
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onHideHud)}
                >
                  <span className="city-menu-icon" aria-hidden="true">
                    ◇
                  </span>
                  <span>
                    <strong>Hide interface</strong>
                    <small>Cinematic view · press H to restore</small>
                  </span>
                </button>
                <button
                  id="new-game-button"
                  className="destructive-menu-action"
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onNewGame)}
                >
                  <span className="city-menu-icon" aria-hidden="true">
                    +
                  </span>
                  <span>
                    <strong>Start a new city</strong>
                    <small>Clear this city and begin again</small>
                  </span>
                </button>
              </div>
              <ActivityLog activity={activity} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export { TopBar };
