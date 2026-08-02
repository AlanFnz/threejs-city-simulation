import { useEffect, useRef, useState } from 'react';
import { IconKey, getIcon } from '../../assetManager/icons';
import CONFIG from '../../config';
import { MILESTONES } from '../../game/milestones/constants';
import { SimulationSpeed } from '../../game/simulationSpeed';
import {
  BaseButton,
  TOOLBAR_BUTTONS,
  TOOL_CATEGORIES,
  ToggleButton,
  ToolCategory,
} from '../constants';

interface ToolBarProps {
  activeToolId: string | null;
  isPaused: boolean;
  simulationSpeed: SimulationSpeed;
  unlockedToolIds: string[];
  onSelectTool: (toolId: string) => void;
  onTogglePause: () => void;
  onCycleSimulationSpeed: () => void;
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

function ToolBar({
  activeToolId,
  isPaused,
  simulationSpeed,
  unlockedToolIds,
  onSelectTool,
  onTogglePause,
  onCycleSimulationSpeed,
}: ToolBarProps) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const toolbar = useRef<HTMLElement>(null);
  const categoryButtons = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const selectTool = (toolId: string): void => {
    if (!unlockedToolIds.includes(toolId)) return;
    onSelectTool(toolId);
    setOpenCategoryId(null);
  };

  const renderDirectTool = (toolId: string) => {
    const button = getToolbarButton(toolId);
    const unlocked = unlockedToolIds.includes(toolId);
    const selected = activeToolId === toolId;
    const label = button.uiText;

    return (
      <button
        id={button.id}
        className={`ui-button${selected ? ' selected' : ''}${
          unlocked ? '' : ' locked'
        }`}
        type="button"
        data-type={button.id}
        data-tooltip={`${label}${unlocked ? '' : ' · Locked'}`}
        title={`${label}${unlocked ? '' : ' · Locked'}`}
        aria-label={label}
        aria-pressed={selected}
        aria-disabled={!unlocked}
        key={button.id}
        onClick={(event) => {
          event.stopPropagation();
          selectTool(button.id);
        }}
      >
        <img className="toolbar-icon" src={getIcon(button.icon)} alt="" />
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
                    unlocked ? '' : ` · Unlock: ${lockedHint}`
                  }`}
                  aria-label={button.uiText}
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

  return (
    <nav ref={toolbar} id="ui-toolbar" aria-label="City controls">
      {renderDirectTool(DIRECT_TOOL_IDS[0])}
      {renderCategory(TOOL_CATEGORIES[0])}
      {renderDirectTool(DIRECT_TOOL_IDS[1])}
      {renderCategory(TOOL_CATEGORIES[1])}
      {renderCategory(TOOL_CATEGORIES[2])}
      {renderDirectTool(DIRECT_TOOL_IDS[2])}
      <div
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
          aria-pressed={isPaused}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePause();
          }}
        >
          <img className="toolbar-icon" src={pauseIcon} alt="" />
        </button>
        <button
          id="simulation-speed-button"
          className={`ui-button speed-cycle-button${
            simulationSpeed > 1 ? ' accelerated' : ''
          }`}
          type="button"
          data-tooltip={`Simulation speed · ${simulationSpeed}×`}
          title={`Cycle simulation speed · Currently ${simulationSpeed}×`}
          aria-label={`Cycle simulation speed. Currently ${simulationSpeed} times`}
          onClick={(event) => {
            event.stopPropagation();
            onCycleSimulationSpeed();
          }}
        >
          <strong>{simulationSpeed}×</strong>
        </button>
      </div>
    </nav>
  );
}

export { ToolBar };
