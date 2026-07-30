import { IconKey, getIcon } from '../../assetManager/icons';
import { BaseButton, TOOLBAR_BUTTONS, ToggleButton } from '../constants';

interface ToolBarProps {
  activeToolId: string | null;
  isPaused: boolean;
  unlockedToolIds: string[];
  onSelectTool: (toolId: string) => void;
  onTogglePause: () => void;
}

function isToggleButton(
  button: BaseButton | ToggleButton
): button is ToggleButton {
  return 'iconPlay' in button && 'iconPause' in button;
}

function ToolBar({
  activeToolId,
  isPaused,
  unlockedToolIds,
  onSelectTool,
  onTogglePause,
}: ToolBarProps) {
  return (
    <div id="ui-toolbar" className="container">
      {Object.values(TOOLBAR_BUTTONS).map((toolbarButton) => {
        const toggleButton = isToggleButton(toolbarButton);
        const unlocked =
          toggleButton || unlockedToolIds.includes(toolbarButton.id);
        const selected = toggleButton
          ? isPaused
          : activeToolId === toolbarButton.id;
        const icon = toggleButton
          ? getIcon(
              isPaused ? toolbarButton.iconPlay : toolbarButton.iconPause
            )
          : getIcon(toolbarButton.icon as IconKey);
        const label = toggleButton
          ? isPaused
            ? toolbarButton.uiTextPause
            : toolbarButton.uiTextPlay
          : toolbarButton.uiText;

        return (
          <button
            id={toolbarButton.id}
            className={`ui-button${selected ? ' selected' : ''}${
              unlocked ? '' : ' locked'
            }`}
            style={{ padding: 8 }}
            type="button"
            data-type={toolbarButton.id}
            key={toolbarButton.id}
            onClick={(event) => {
              event.stopPropagation();
              if (toggleButton) {
                onTogglePause();
                return;
              }
              if (!unlocked) return;
              onSelectTool(toolbarButton.id);
            }}
          >
            <img className="toolbar-icon" src={icon} alt={label} />
          </button>
        );
      })}
    </div>
  );
}

export { ToolBar };
