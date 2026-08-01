import { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainer = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuContainer.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const runAction = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

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
        <div className="city-menu" ref={menuContainer}>
          <button
            id="city-menu-button"
            ref={menuButton}
            className={`city-menu-trigger${menuOpen ? ' active' : ''}`}
            type="button"
            aria-label="City management menu"
            aria-expanded={menuOpen}
            aria-controls="city-management-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-trigger-icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="menu-trigger-label">Menu</span>
          </button>
          {menuOpen && (
            <div
              id="city-management-menu"
              className="city-management-menu"
              role="menu"
              aria-label="City management"
            >
              <header>
                <span className="panel-eyebrow">City management</span>
                <strong>Game options</strong>
              </header>
              <div className="city-menu-actions">
                <button
                  id="save-game-button"
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onSave)}
                >
                  <span className="city-menu-icon" aria-hidden="true">
                    ↓
                  </span>
                  <span>
                    <strong>Save city</strong>
                    <small>Store your current progress</small>
                  </span>
                </button>
                <button
                  id="load-game-button"
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onLoad)}
                >
                  <span className="city-menu-icon" aria-hidden="true">
                    ↻
                  </span>
                  <span>
                    <strong>Load city</strong>
                    <small>Restore your latest save</small>
                  </span>
                </button>
                <button
                  id="new-game-button"
                  className="destructive-menu-action"
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onNewGame)}
                >
                  <span className="city-menu-icon" aria-hidden="true">
                    +
                  </span>
                  <span>
                    <strong>Start a new city</strong>
                    <small>Clear this city and begin again</small>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export { TopBar };
