import personIcon from '../../assetManager/icons/person.png';
import CONFIG from '../../config';
import { CustomWindow } from '../../types';

declare let window: CustomWindow;

function TopBar() {
  return (
    <div id="ui-topbar">
      <div
        id="ui-topbar-left-items"
        className="ui-topbar-items ui-topbar-left-items"
      >
        $<span id="money-counter">{CONFIG.ECONOMY.STARTING_MONEY}</span>
      </div>

      <div
        id="ui-topbar-center-items"
        className="ui-topbar-items ui-topbar-center-items"
      >
        My City
      </div>

      <div
        id="ui-topbar-right-items"
        className="ui-topbar-items ui-topbar-right-items"
      >
        <img id="population-icon" src={personIcon} alt="" />
        <span id="population-counter">0</span>
        <button
          id="save-game-button"
          className="text-button"
          type="button"
          onClick={() => window.game.saveGame()}
        >
          Save
        </button>
        <button
          id="load-game-button"
          className="text-button"
          type="button"
          onClick={() => window.game.loadGame()}
        >
          Load
        </button>
        <button
          id="new-game-button"
          className="text-button"
          type="button"
          onClick={() => window.game.newGame()}
        >
          New Game
        </button>
      </div>
    </div>
  );
}

export { TopBar };
