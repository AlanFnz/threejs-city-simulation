import { MouseEvent as ReactMouseEvent, useEffect, useRef } from 'react';
import { CityMapTileKind, CityMapUiState } from '../store';

interface CityMapProps {
  map: CityMapUiState;
  onFocusTile(x: number, y: number): void;
}

const MAP_SIZE = 128;
const COLOR_BY_KIND: Record<CityMapTileKind, string> = {
  empty: '#44763f',
  road: '#c2c9c7',
  residential: '#8bd37e',
  commercial: '#69b8e8',
  industrial: '#e5bd68',
  'power-line': '#c5a2f2',
  'power-plant': '#9e75d1',
  service: '#e9898b',
};

const ZONE_KINDS: CityMapTileKind[] = [
  'residential',
  'commercial',
  'industrial',
];

interface CityMapPoint {
  x: number;
  y: number;
}

function getCityMapTileFromPoint(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  citySize: number
): CityMapPoint | null {
  if (width <= 0 || height <= 0 || citySize <= 0) return null;
  const normalizedX = Math.min(1, Math.max(0, offsetX / width));
  const normalizedY = Math.min(1, Math.max(0, offsetY / height));
  return {
    x: Math.min(citySize - 1, Math.floor(normalizedX * citySize)),
    y: Math.min(citySize - 1, Math.floor(normalizedY * citySize)),
  };
}

function getMapTileKind(
  map: CityMapUiState,
  x: number,
  y: number
): CityMapTileKind | null {
  if (x < 0 || y < 0 || x >= map.size || y >= map.size) return null;
  return map.tiles[x * map.size + y] ?? null;
}

function drawZoneParcel(
  context: CanvasRenderingContext2D,
  kind: CityMapTileKind,
  x: number,
  y: number,
  tileSize: number
): void {
  const inset = Math.max(0.35, tileSize * 0.075);
  context.fillStyle = COLOR_BY_KIND[kind];
  context.fillRect(
    x * tileSize + inset,
    y * tileSize + inset,
    Math.max(0.5, tileSize - inset * 2),
    Math.max(0.5, tileSize - inset * 2)
  );
  context.strokeStyle = 'rgba(22, 46, 34, 0.34)';
  context.lineWidth = Math.max(0.35, tileSize * 0.045);
  context.strokeRect(
    x * tileSize + inset,
    y * tileSize + inset,
    Math.max(0.5, tileSize - inset * 2),
    Math.max(0.5, tileSize - inset * 2)
  );
}

function drawFacilityMarker(
  context: CanvasRenderingContext2D,
  kind: 'power-plant' | 'service',
  x: number,
  y: number,
  tileSize: number
): void {
  const centerX = (x + 0.5) * tileSize;
  const centerY = (y + 0.5) * tileSize;
  const radius = Math.max(1.2, tileSize * 0.32);
  context.fillStyle = COLOR_BY_KIND[kind];
  context.strokeStyle = 'rgba(24, 29, 38, 0.58)';
  context.lineWidth = Math.max(0.45, tileSize * 0.07);
  context.beginPath();
  if (kind === 'service') {
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  } else {
    context.rect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  }
  context.fill();
  context.stroke();

  context.fillStyle = kind === 'service' ? '#f9e5e1' : '#f5dc72';
  context.beginPath();
  context.arc(centerX, centerY, Math.max(0.55, tileSize * 0.09), 0, Math.PI * 2);
  context.fill();
}

function drawNetworkTile(
  context: CanvasRenderingContext2D,
  map: CityMapUiState,
  kind: 'road' | 'power-line',
  x: number,
  y: number,
  tileSize: number
): void {
  const centerX = (x + 0.5) * tileSize;
  const centerY = (y + 0.5) * tileSize;
  const connectsTo = (neighbor: CityMapTileKind | null): boolean =>
    kind === 'road'
      ? neighbor === 'road'
      : neighbor === 'power-line' || neighbor === 'power-plant';
  const directions = [
    { dx: -1, dy: 0, edgeX: x * tileSize, edgeY: centerY },
    { dx: 1, dy: 0, edgeX: (x + 1) * tileSize, edgeY: centerY },
    { dx: 0, dy: -1, edgeX: centerX, edgeY: y * tileSize },
    { dx: 0, dy: 1, edgeX: centerX, edgeY: (y + 1) * tileSize },
  ];

  context.beginPath();
  let hasConnection = false;
  for (const direction of directions) {
    if (!connectsTo(getMapTileKind(map, x + direction.dx, y + direction.dy)))
      continue;
    context.moveTo(centerX, centerY);
    context.lineTo(direction.edgeX, direction.edgeY);
    hasConnection = true;
  }
  if (!hasConnection) {
    context.moveTo(centerX - tileSize * 0.3, centerY);
    context.lineTo(centerX + tileSize * 0.3, centerY);
  }

  context.lineCap = kind === 'road' ? 'square' : 'round';
  context.strokeStyle =
    kind === 'road' ? 'rgba(42, 52, 54, 0.72)' : 'rgba(59, 39, 79, 0.72)';
  context.lineWidth = Math.max(1, tileSize * (kind === 'road' ? 0.44 : 0.24));
  context.stroke();
  context.strokeStyle = COLOR_BY_KIND[kind];
  context.lineWidth = Math.max(0.65, tileSize * (kind === 'road' ? 0.27 : 0.12));
  context.stroke();

  context.fillStyle = COLOR_BY_KIND[kind];
  context.beginPath();
  context.arc(
    centerX,
    centerY,
    Math.max(0.55, tileSize * (kind === 'road' ? 0.14 : 0.09)),
    0,
    Math.PI * 2
  );
  context.fill();
}

function CityMap({ map, onFocusTile }: CityMapProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const occupiedTiles = map.tiles.filter((kind) => kind !== 'empty').length;

  const focusCityCenter = () => {
    const center = Math.floor(map.size / 2);
    onFocusTile(center, center);
  };

  const handleMapClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) {
      focusCityCenter();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const tile = getCityMapTileFromPoint(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      bounds.width,
      bounds.height,
      map.size
    );
    if (tile) onFocusTile(tile.x, tile.y);
  };

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context || map.size <= 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = MAP_SIZE * pixelRatio;
    element.height = MAP_SIZE * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    const terrain = context.createLinearGradient(0, 0, MAP_SIZE, MAP_SIZE);
    terrain.addColorStop(0, '#54864a');
    terrain.addColorStop(0.55, COLOR_BY_KIND.empty);
    terrain.addColorStop(1, '#315f38');
    context.fillStyle = terrain;
    context.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    const tileSize = MAP_SIZE / map.size;
    map.tiles.forEach((kind, index) => {
      const x = Math.floor(index / map.size);
      const y = index % map.size;
      if (ZONE_KINDS.includes(kind)) {
        drawZoneParcel(context, kind, x, y, tileSize);
      } else if (kind === 'power-plant' || kind === 'service') {
        drawFacilityMarker(context, kind, x, y, tileSize);
      }
    });
    map.tiles.forEach((kind, index) => {
      if (kind !== 'road' && kind !== 'power-line') return;
      drawNetworkTile(
        context,
        map,
        kind,
        Math.floor(index / map.size),
        index % map.size,
        tileSize
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
        <span className="city-minimap-count">
          {occupiedTiles} built <span aria-hidden="true">⌖</span>
        </span>
      </header>
      <button
        type="button"
        className="city-minimap-focus"
        aria-label="Recenter camera. Choose a location on the city minimap."
        title="Click a location to recenter the camera"
        onClick={handleMapClick}
      >
        <canvas
          ref={canvas}
          width={MAP_SIZE}
          height={MAP_SIZE}
          aria-hidden="true"
        />
      </button>
      <div className="city-minimap-legend" aria-hidden="true">
        <span className="residential">R</span>
        <span className="commercial">C</span>
        <span className="industrial">I</span>
        <span className="road">Road</span>
        <span className="power-line">Power</span>
      </div>
    </aside>
  );
}

export { CityMap, getCityMapTileFromPoint };
