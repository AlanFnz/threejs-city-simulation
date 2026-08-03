import { useEffect, useRef, useState } from 'react';
import { IconKey, getIcon } from '../../assetManager/icons';
import CONFIG from '../../config';
import { MILESTONES } from '../../game/milestones/constants';
import {
  SIMULATION_SPEEDS,
  SimulationSpeed,
} from '../../game/simulationSpeed';
import {
  BaseButton,
  TOOLBAR_BUTTONS,
  TOOL_CATEGORIES,
  ToggleButton,
  ToolCategory,
} from '../constants';
import { getKeyboardShortcutAction } from '../keyboardShortcuts';

interface ToolBarProps {
  activeToolId: string | null;
  money: number;
  isPaused: boolean;
  simulationSpeed: SimulationSpeed;
  unlockedToolIds: string[];
  hasOpenInspector: boolean;
  onSelectTool: (toolId: string) => void;
  onCloseInspector: () => void;
  onTogglePause: () => void;
  onSetSimulationSpeed: (speed: SimulationSpeed) => void;
  onCycleSimulationSpeed: () => void;
  onToggleHud: () => void;
}

const DIRECT_TOOL_IDS = ['SELECT', 'ROAD', 'BULLDOZE'];
const BUILD_COSTS = CONFIG.ECONOMY.BUILD_COST as Record<string, number>;

function getToolbarButton(toolId: string): BaseButton | ToggleButton {
  const button = Object.values(TOOLBAR_BUTTONS).find(
    (candidate) => candidate.id === toolId
  );
  if (!button) throw new Error(`Unknown toolbar button: ${toolId}`);
  return button;
}

function getLockedHint(toolId: string): string {
  const milestone = MILESTONES.find(
    ({ reward }) => reward.type === 'unlockTool' && reward.toolId === toolId
  );
  if (milestone?.condition.type === 'population') {
    return `${milestone.condition.atLeast} residents`;
  }
  return milestone?.title ?? 'Locked';
}

function formatShortcut(shortcut: string): string {
  return shortcut === 'Escape' ? 'Esc' : shortcut;
}

function ToolBar({
  activeToolId,
  money,
  isPaused,
  simulationSpeed,
  unlockedToolIds,
  hasOpenInspector,
  onSelectTool,
  onCloseInspector,
  onTogglePause,
  onSetSimulationSpeed,
  onCycleSimulationSpeed,
  onToggleHud,
}: ToolBarProps) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [isSpeedPickerOpen, setIsSpeedPickerOpen] = useState(false);
  const toolbar = useRef<HTMLElement>(null);
  const categoryButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const speedControls = useRef<HTMLDivElement>(null);
  const speedButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openCategoryId) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (!toolbar.current?.contains(event.target as Node)) {
        setOpenCategoryId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpenCategoryId(null);
      categoryButtons.current[openCategoryId]?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openCategoryId]);

  useEffect(() => {
    if (!isSpeedPickerOpen) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (!speedControls.current?.contains(event.target as Node)) {
        setIsSpeedPickerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setIsSpeedPickerOpen(false);
      speedButton.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isSpeedPickerOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof Element &&
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }

      const action = getKeyboardShortcutAction(event.key, event.repeat);
      if (!action) return;
      event.preventDefault();

      if (action.type === 'selectTool') {
        if (!unlockedToolIds.includes(action.toolId)) return;
        if (
          action.toolId === TOOLBAR_BUTTONS.SELECT.id &&
          hasOpenInspector
        ) {
          onCloseInspector();
        }
        onSelectTool(action.toolId);
        setOpenCategoryId(null);
      } else if (action.type === 'togglePause') {
        onTogglePause();
      } else if (action.type === 'cycleSimulationSpeed') {
        onCycleSimulationSpeed();
        setIsSpeedPickerOpen(false);
      } else {
        onToggleHud();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    hasOpenInspector,
    onCloseInspector,
    onCycleSimulationSpeed,
    onSelectTool,
    onToggleHud,
    onTogglePause,
    unlockedToolIds,
  ]);

  const selectTool = (toolId: string): void => {
    if (!unlockedToolIds.includes(toolId)) return;
    onSelectTool(toolId);
    setOpenCategoryId(null);
    setIsSpeedPickerOpen(false);
  };

  const renderDirectTool = (toolId: string) => {
    const button = getToolbarButton(toolId);
    const unlocked = unlockedToolIds.includes(toolId);
    const selected = activeToolId === toolId;
    const label = button.uiText;
    const tooltip = `${label}${
      button.shortcut ? ` · ${formatShortcut(button.shortcut)}` : ''
    }${unlocked ? '' : ' · Locked'}`;

    return (
      <button
        id={button.id}
        className={`ui-button${selected ? ' selected' : ''}${
          unlocked ? '' : ' locked'
        }`}
        type="button"
        data-type={button.id}
        data-tooltip={tooltip}
        title={tooltip}
        aria-label={label}
        aria-keyshortcuts={button.shortcut}
        aria-pressed={selected}
        aria-disabled={!unlocked}
        key={button.id}
        onClick={(event) => {
          event.stopPropagation();
          selectTool(button.id);
        }}
      >
        <img className="toolbar-icon" src={getIcon(button.icon)} alt="" />
        {button.shortcut && (
          <kbd className="tool-shortcut-badge">
            {formatShortcut(button.shortcut)}
          </kbd>
        )}
      </button>
    );
  };

  const renderCategory = (category: ToolCategory) => {
    const isOpen = openCategoryId === category.id;
    const isActive = category.toolIds.includes(activeToolId ?? '');
    const trayId = `tool-tray-${category.id.toLowerCase()}`;

    return (
      <div
        className="dock-category"
        data-category={category.id}
        key={category.id}
      >
        <button
          ref={(element) => {
            categoryButtons.current[category.id] = element;
          }}
          className={`ui-button category-button${isActive ? ' selected' : ''}${
            isOpen ? ' open' : ''
          }`}
          type="button"
          data-tooltip={category.label}
          title={category.label}
          aria-label={`${category.label} tools`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-pressed={isActive}
          aria-controls={trayId}
          onClick={(event) => {
            event.stopPropagation();
            setIsSpeedPickerOpen(false);
            setOpenCategoryId(isOpen ? null : category.id);
          }}
        >
          <img className="toolbar-icon" src={getIcon(category.icon)} alt="" />
          <span className="category-indicator" aria-hidden="true" />
        </button>

        <div
          id={trayId}
          className={`tool-tray${isOpen ? ' open' : ''}`}
          role="dialog"
          aria-label={`${category.label} tools`}
          aria-hidden={!isOpen}
        >
          <div className="tool-tray-heading">
            <span>{category.label}</span>
            <small>Choose a tool</small>
          </div>
          <div
            className="tool-tray-options"
            style={{
              gridTemplateColumns: `repeat(${category.toolIds.length}, 1fr)`,
            }}
          >
            {category.toolIds.map((toolId) => {
              const button = getToolbarButton(toolId);
              const unlocked = unlockedToolIds.includes(toolId);
              const selected = activeToolId === toolId;
              const cost = BUILD_COSTS[toolId];
              const lockedHint = getLockedHint(toolId);

              return (
                <button
                  id={button.id}
                  className={`tool-option${selected ? ' selected' : ''}${
                    unlocked ? '' : ' locked'
                  }`}
                  type="button"
                  data-type={button.id}
                  title={`${button.uiText}${
                    button.shortcut
                      ? ` · ${formatShortcut(button.shortcut)}`
                      : ''
                  }${unlocked ? '' : ` · Unlock: ${lockedHint}`
                  }`}
                  aria-label={button.uiText}
                  aria-keyshortcuts={button.shortcut}
                  aria-pressed={selected}
                  aria-disabled={!unlocked}
                  tabIndex={isOpen ? 0 : -1}
                  key={button.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectTool(button.id);
                  }}
                >
                  <span className="tool-option-icon">
                    <img src={getIcon(button.icon as IconKey)} alt="" />
                    {button.shortcut && (
                      <kbd className="tool-shortcut-badge">
                        {formatShortcut(button.shortcut)}
                      </kbd>
                    )}
                  </span>
                  <strong>{button.uiText}</strong>
                  <small className={unlocked ? 'tool-cost' : 'tool-locked'}>
                    {unlocked
                      ? typeof cost === 'number'
                        ? `$${cost.toLocaleString()}`
                        : 'Available'
                      : lockedHint}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const pauseButton = getToolbarButton(
    TOOLBAR_BUTTONS.TOGGLE_PAUSE.id
  ) as ToggleButton;
  const pauseLabel = isPaused
    ? pauseButton.uiTextPlay
    : pauseButton.uiTextPause;
  const pauseIcon = getIcon(
    isPaused ? pauseButton.iconPlay : pauseButton.iconPause
  );
  const activeButton = activeToolId
    ? getToolbarButton(activeToolId)
    : getToolbarButton(TOOLBAR_BUTTONS.SELECT.id);
  const activeCost = BUILD_COSTS[activeButton.id];
  const isPlacementTool = typeof activeCost === 'number';
  const canAffordActiveTool = !isPlacementTool || money >= activeCost;
  const activeInstruction =
    activeButton.id === TOOLBAR_BUTTONS.SELECT.id
      ? 'Inspect city tiles'
      : activeButton.id === TOOLBAR_BUTTONS.BULLDOZE.id
        ? 'Clear buildings and infrastructure'
        : activeButton.id === TOOLBAR_BUTTONS.ROAD.id ||
            TOOL_CATEGORIES[0].toolIds.includes(activeButton.id)
          ? 'Click or drag to place'
          : 'Click a tile to place';
  const affordabilityText = canAffordActiveTool
    ? isPlacementTool
      ? `$${activeCost.toLocaleString()} per tile`
      : 'No build cost'
    : `$${(activeCost - money).toLocaleString()} more needed`;

  return (
    <nav ref={toolbar} id="ui-toolbar" aria-label="City controls">
      <div
        id="active-tool-context"
        className={`active-tool-context${
          openCategoryId || isSpeedPickerOpen ? ' category-open' : ''
        }${canAffordActiveTool ? '' : ' insufficient-funds'}`}
        aria-label={`${activeButton.uiText}. ${activeInstruction}. ${affordabilityText}`}
      >
        <span className="active-tool-icon" aria-hidden="true">
          <img src={getIcon(activeButton.icon)} alt="" />
        </span>
        <span className="active-tool-copy">
          <small>Active tool</small>
          <strong>{activeButton.uiText}</strong>
        </span>
        <span className="active-tool-detail">
          <small>{activeInstruction}</small>
          <strong>{affordabilityText}</strong>
        </span>
      </div>
      {renderDirectTool(DIRECT_TOOL_IDS[0])}
      {renderCategory(TOOL_CATEGORIES[0])}
      {renderDirectTool(DIRECT_TOOL_IDS[1])}
      {renderCategory(TOOL_CATEGORIES[1])}
      {renderCategory(TOOL_CATEGORIES[2])}
      {renderDirectTool(DIRECT_TOOL_IDS[2])}
      <div
        ref={speedControls}
        className="simulation-controls"
        role="group"
        aria-label="Simulation speed"
      >
        <button
          id={pauseButton.id}
          className={`ui-button simulation-control${isPaused ? ' selected' : ''}`}
          type="button"
          data-type={pauseButton.id}
          data-tooltip={pauseLabel}
          title={pauseLabel}
          aria-label={pauseLabel}
          aria-keyshortcuts="Space"
          aria-pressed={isPaused}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePause();
          }}
        >
          <img className="toolbar-icon" src={pauseIcon} alt="" />
        </button>
        <button
          ref={speedButton}
          id="simulation-speed-button"
          className={`ui-button speed-cycle-button${
            simulationSpeed > 1 ? ' accelerated' : ''
          }${isSpeedPickerOpen ? ' open' : ''}`}
          type="button"
          data-tooltip={`Simulation speed · ${simulationSpeed}×`}
          title={`Choose simulation speed · Currently ${simulationSpeed}×`}
          aria-label={`Choose simulation speed. Currently ${simulationSpeed} times`}
          aria-keyshortcuts="."
          aria-haspopup="dialog"
          aria-expanded={isSpeedPickerOpen}
          aria-controls="simulation-speed-picker"
          onClick={(event) => {
            event.stopPropagation();
            setOpenCategoryId(null);
            setIsSpeedPickerOpen((isOpen) => !isOpen);
          }}
        >
          <strong>{simulationSpeed}×</strong>
        </button>
        <div
          id="simulation-speed-picker"
          className={`speed-picker${isSpeedPickerOpen ? ' open' : ''}`}
          role="dialog"
          aria-label="Choose simulation speed"
          aria-hidden={!isSpeedPickerOpen}
        >
          <span>Simulation speed</span>
          <div role="radiogroup" aria-label="Simulation speed options">
            {SIMULATION_SPEEDS.map((speed) => (
              <button
                key={speed}
                id={`simulation-speed-${speed}`}
                type="button"
                role="radio"
                aria-checked={simulationSpeed === speed}
                tabIndex={isSpeedPickerOpen ? 0 : -1}
                onClick={() => {
                  onSetSimulationSpeed(speed);
                  setIsSpeedPickerOpen(false);
                  speedButton.current?.focus();
                }}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

export { ToolBar };
