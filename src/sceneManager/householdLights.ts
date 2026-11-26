import { MathUtils } from 'three';
import type { Citizen } from '../city/citizen';

export function residentSpread(id: string): number {
  let hash = 0;
  for (const letter of id)
    hash = (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0;
  return (Math.imul(hash, 2654435761) >>> 0) / 2 ** 32;
}

export function shiftEnd(spread: number): number {
  return 17 * 60 + spread * 90;
}

// For commuters outside the visible pedestrian sample, use their own shift
// and the distance from their workplace. Visible walks report the doorstep arrival.
export function estimatedHomecoming(person: Citizen): number {
  const job = person.workplace;
  if (!job) return 0;
  const blocks =
    Math.abs(job.x - person.residence.x) + Math.abs(job.y - person.residence.y);
  return shiftEnd(residentSpread(person.id)) + 15 + 15 * blocks;
}

export function householdLights(
  residents: readonly Citizen[],
  minute: number,
  homeSince: (person: Citizen) => number
): number {
  if (!residents.length) return 0;
  if (minute < 7 * 60) return 1 - MathUtils.smoothstep(minute, 5 * 60, 7 * 60);
  if (minute < 16 * 60) return 0;
  let lit = 0;
  for (const person of residents) {
    const evening = 16.5 * 60 + residentSpread(person.id) * 70;
    const arrival = Math.max(evening, homeSince(person));
    if (minute >= arrival)
      lit += 0.35 + 0.65 * MathUtils.smoothstep(minute, arrival, arrival + 35);
  }
  return lit / residents.length;
}
