import personIcon from '../../assetManager/icons/person.png';
import CONFIG from '../../config';
import { CustomWindow } from '../../types';

declare let window: CustomWindow;

function createTopBar() {
  const topbar = document.getElementById('ui-topbar') as HTMLElement;
  if (!topbar) {
    console.error('Title bar element not found!');
    return;
  }

  const topbarLeftItems = document.createElement('div');
  topbarLeftItems.id = 'ui-topbar-left-items';
  topbarLeftItems.className = 'ui-topbar-items ui-topbar-left-items';
  topbarLeftItems.innerHTML = `$<span id="money-counter">${CONFIG.ECONOMY.STARTING_MONEY}</span>`;
  topbar.appendChild(topbarLeftItems);

  const topbarCenterItems = document.createElement('div');
  topbarCenterItems.id = 'ui-topbar-center-items';
  topbarCenterItems.className = 'ui-topbar-items ui-topbar-center-items';
  topbarCenterItems.textContent = 'My City';
  topbar.appendChild(topbarCenterItems);

  const topbarRightItems = document.createElement('div');
  topbarRightItems.id = 'ui-topbar-right-items';
  topbarRightItems.className = 'ui-topbar-items ui-topbar-right-items';
  topbarRightItems.innerHTML =
    `<img id="population-icon" src=${personIcon}>` +
    '<span id="population-counter">0</span>' +
    '<button id="save-game-button" class="text-button">Save</button>' +
    '<button id="load-game-button" class="text-button">Load</button>' +
    '<button id="new-game-button" class="text-button">New Game</button>';
  topbar.appendChild(topbarRightItems);

  document.getElementById('save-game-button')?.addEventListener('click', () => {
    window.game.saveGame();
  });
  document.getElementById('load-game-button')?.addEventListener('click', () => {
    window.game.loadGame();
  });
  document.getElementById('new-game-button')?.addEventListener('click', () => {
    window.game.newGame();
  });
}

export { createTopBar };
