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
    <header id="ui-topbar" aria-label="City status">
      <div
        id="ui-topbar-left-items"
        className="ui-topbar-items ui-topbar-left-items"
      >
        <div className="hud-stat hud-stat-money">
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
          </span>
        </div>
      </div>

      <div
        id="ui-topbar-center-items"
        className="ui-topbar-items ui-topbar-center-items"
      >
        <span className="city-name">My City</span>
        <span className="city-status">City operations</span>
      </div>

      <div
        id="ui-topbar-right-items"
        className="ui-topbar-items ui-topbar-right-items"
      >
        <div className="hud-stat hud-stat-population">
          <span className="hud-stat-icon">
            <img id="population-icon" src={personIcon} alt="" />
          </span>
          <span className="hud-stat-copy">
            <span className="hud-stat-label">Population</span>
            <strong id="population-counter">
              {population.toLocaleString()}
            </strong>
          </span>
        </div>
        <div className="hud-actions" aria-label="Game actions">
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
            New
          </button>
        </div>
      </div>
    </header>
  );
}

export { TopBar };
