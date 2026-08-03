import { useEffect, useRef } from 'react';
import { CityMapTileKind, CityMapUiState } from '../store';

interface CityMapProps {
  map: CityMapUiState;
}

const MAP_SIZE = 128;
const COLOR_BY_KIND: Record<CityMapTileKind, string> = {
  empty: '#183148',
  road: '#aab7c1',
  residential: '#65c97a',
  commercial: '#4ba9e8',
  industrial: '#e9b94e',
  power: '#b58cf2',
  service: '#f47782',
};

function CityMap({ map }: CityMapProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const occupiedTiles = map.tiles.filter((kind) => kind !== 'empty').length;

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context || map.size <= 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = MAP_SIZE * pixelRatio;
    element.height = MAP_SIZE * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    context.fillStyle = COLOR_BY_KIND.empty;
    context.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    const tileSize = MAP_SIZE / map.size;
    map.tiles.forEach((kind, index) => {
      if (kind === 'empty') return;
      const x = Math.floor(index / map.size);
      const y = index % map.size;
      const inset = Math.max(0.35, tileSize * 0.07);
      context.fillStyle = COLOR_BY_KIND[kind];
      context.fillRect(
        x * tileSize + inset,
        y * tileSize + inset,
        Math.max(0.5, tileSize - inset * 2),
        Math.max(0.5, tileSize - inset * 2)
      );
    });
  }, [map]);

  return (
    <aside
      id="city-minimap"
      className="hud-panel"
      aria-label={`City minimap. ${occupiedTiles} of ${map.size * map.size} tiles occupied.`}
    >
      <header className="city-minimap-heading">
        <span>
          <small>City overview</small>
          <strong>Map</strong>
        </span>
        <span className="city-minimap-count">{occupiedTiles} built</span>
      </header>
      <canvas ref={canvas} width={MAP_SIZE} height={MAP_SIZE} aria-hidden="true" />
      <div className="city-minimap-legend" aria-hidden="true">
        <span className="residential">R</span>
        <span className="commercial">C</span>
        <span className="industrial">I</span>
        <span className="road">Road</span>
        <span className="power">Utility</span>
      </div>
    </aside>
  );
}

export { CityMap };
