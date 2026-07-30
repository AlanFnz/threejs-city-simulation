import personIcon from '../../assetManager/icons/person.png';

interface TopBarProps {
  money: number;
  population: number;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
}

function TopBar({
  money,
  population,
  onSave,
  onLoad,
  onNewGame,
}: TopBarProps) {
  return (
    <div id="ui-topbar">
      <div
        id="ui-topbar-left-items"
        className="ui-topbar-items ui-topbar-left-items"
      >
        $
        <span id="money-counter" className={money < 0 ? 'low-funds' : undefined}>
          {Math.floor(money)}
        </span>
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
        <span id="population-counter">{population}</span>
        <button
          id="save-game-button"
          className="text-button"
          type="button"
          onClick={onSave}
        >
          Save
        </button>
        <button
          id="load-game-button"
          className="text-button"
          type="button"
          onClick={onLoad}
        >
          Load
        </button>
        <button
          id="new-game-button"
          className="text-button"
          type="button"
          onClick={onNewGame}
        >
          New Game
        </button>
      </div>
    </div>
  );
}

export { TopBar };
