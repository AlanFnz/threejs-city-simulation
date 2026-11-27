import { BUILDING_TYPE } from '../city/building/constants';
import type { ICity } from '../city';

const clamp = (x: number) => Math.max(0, Math.min(1, x));

// The camera shows five tiles vertically at zoom 2 and twenty at zoom 0.5.
function streetGain(zoom: number): number {
  const t = clamp((zoom - 0.5) / 1.5);
  return t * t * (3 - 2 * t);
}

export function neighborhoodMix(
  city: ICity,
  x: number,
  z: number,
  zoom: number,
  dark: number
) {
  const detail = clamp(zoom / 2);
  const radius = Math.round(6 - 3 * detail);
  let activity = 0;
  let weight = 0;
  for (let i = Math.round(x) - radius; i <= Math.round(x) + radius; i++) {
    for (let j = Math.round(z) - radius; j <= Math.round(z) + radius; j++) {
      const proximity = Math.max(0, 1 - Math.hypot(i - x, j - z) / radius);
      if (!proximity) continue;
      weight += proximity;
      const type = city.getTile(i, j)?.building?.type;
      if (type === BUILDING_TYPE.RESIDENTIAL) activity += proximity;
      if (
        type === BUILDING_TYPE.COMMERCIAL ||
        type === BUILDING_TYPE.INDUSTRIAL ||
        type === BUILDING_TYPE.ROAD
      )
        activity += 1.3 * proximity;
    }
  }
  const built = clamp((2 * activity) / Math.max(1, weight));
  const edge = Math.min(
    x + 0.5,
    z + 0.5,
    city.size - 0.5 - x,
    city.size - 0.5 - z
  );
  const coast = clamp(1 - Math.max(0, edge) / 7);
  return {
    shore: coast * (0.36 + 0.5 * detail),
    street: built * 0.94 * streetGain(zoom) * (1 - 0.92 * dark),
    night: dark * (0.22 + 0.32 * detail) * (1 - 0.55 * coast),
    leaves: (0.21 + 0.22 * detail) * (1 - 0.55 * built) * (1 - 0.45 * dark),
    cutoff: 1600 + 13900 * detail,
  };
}

export function vehiclePerspective(
  dx: number,
  dz: number,
  zoom: number,
  rightX: number,
  rightZ: number,
  range = 10
) {
  const distance = Math.hypot(dx, dz);
  return {
    gain: streetGain(zoom) * clamp(1 - distance / range) ** 2,
    pan: Math.max(
      -0.85,
      Math.min(0.85, (dx * rightX + dz * rightZ) / (1.4 + distance))
    ),
  };
}
