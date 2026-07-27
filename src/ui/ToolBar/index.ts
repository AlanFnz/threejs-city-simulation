import { IconKey, getIcon } from '../../assetManager/icons';
import { CustomWindow } from '../../types';
import { BaseButton, TOOLBAR_BUTTONS, ToggleButton } from '../constants';

declare let window: CustomWindow;

function isToggleButton(
  button: BaseButton | ToggleButton
): button is ToggleButton {
  return 'iconPlay' in button && 'iconPause' in button;
}

function createToolBar(isUnlocked: (toolId: string) => boolean) {
  const toolbar = document.getElementById('ui-toolbar') as HTMLElement;
  if (!toolbar) {
    console.error('Toolbar element not found!');
    return;
  }

  toolbar.className = 'container'

  Object.values(TOOLBAR_BUTTONS).forEach((toolbarButton) => {
    const button = document.createElement('button');
    button.id = toolbarButton.id;
    button.className = 'ui-button';
    button.style.padding = '8px';

    const iconImg = document.createElement('img');
    iconImg.style.width = '100%';
    iconImg.style.height = '100%';
    iconImg.style.pointerEvents = 'none';
    iconImg.className = 'toolbar-icon';

    if (isToggleButton(toolbarButton)) {
      const isPaused = window.game?.isPaused ?? false;
      button.onclick = (event) => {
        event.stopPropagation();
        window.game.togglePause();
      };
      iconImg.src = getIcon(
        isPaused ? toolbarButton.iconPlay : toolbarButton.iconPause
      );
      iconImg.alt = isPaused
        ? toolbarButton.uiTextPause
        : toolbarButton.uiTextPlay;
    } else {
      if (isUnlocked(toolbarButton.id)) {
        button.onclick = (event) => {
          event.stopPropagation();
          window.game.onToolSelected(event);
        };
      } else {
        button.classList.add('locked');
      }
      iconImg.src = getIcon(toolbarButton.icon as IconKey);
      iconImg.alt = toolbarButton.uiText;
    }

    button.appendChild(iconImg);
    button.dataset.type = toolbarButton.id;
    toolbar.appendChild(button);
  });
}

export { createToolBar };

