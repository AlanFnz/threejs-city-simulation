import { useState } from 'react';
import { IconKey, getIcon } from '../../assetManager/icons';
import CONFIG from '../../config';
import { MILESTONES } from '../../game/milestones/constants';
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
  unlockedToolIds: string[];
  onSelectTool: (toolId: string) => void;
  onTogglePause: () => void;
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
  unlockedToolIds,
  onSelectTool,
  onTogglePause,
}: ToolBarProps) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

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
          className={`ui-button category-button${isActive ? ' selected' : ''}${
            isOpen ? ' open' : ''
          }`}
          type="button"
          data-tooltip={category.label}
          title={category.label}
          aria-label={`${category.label} tools`}
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
    <nav id="ui-toolbar" aria-label="City building tools">
      {renderDirectTool(DIRECT_TOOL_IDS[0])}
      {renderCategory(TOOL_CATEGORIES[0])}
      {renderDirectTool(DIRECT_TOOL_IDS[1])}
      {renderCategory(TOOL_CATEGORIES[1])}
      {renderCategory(TOOL_CATEGORIES[2])}
      {renderDirectTool(DIRECT_TOOL_IDS[2])}
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
    </nav>
  );
}

export { ToolBar };
