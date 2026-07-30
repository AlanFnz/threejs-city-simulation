import { IconKey, getIcon } from '../../assetManager/icons';
import { CustomWindow } from '../../types';
import { BaseButton, TOOLBAR_BUTTONS, ToggleButton } from '../constants';

declare let window: CustomWindow;

interface ToolBarProps {
  isUnlocked: (toolId: string) => boolean;
}

function isToggleButton(
  button: BaseButton | ToggleButton
): button is ToggleButton {
  return 'iconPlay' in button && 'iconPause' in button;
}

function ToolBar({ isUnlocked }: ToolBarProps) {
  return (
    <div id="ui-toolbar" className="container">
      {Object.values(TOOLBAR_BUTTONS).map((toolbarButton) => {
        const toggleButton = isToggleButton(toolbarButton);
        const isPaused = window.game?.isPaused ?? false;
        const unlocked = toggleButton || isUnlocked(toolbarButton.id);
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
            className={`ui-button${unlocked ? '' : ' locked'}`}
            style={{ padding: 8 }}
            type="button"
            data-type={toolbarButton.id}
            key={toolbarButton.id}
            onClick={(event) => {
              event.stopPropagation();
              if (toggleButton) {
                window.game.togglePause();
                return;
              }
              if (!isUnlocked(toolbarButton.id)) return;
              window.game.onToolSelected(event.nativeEvent);
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
