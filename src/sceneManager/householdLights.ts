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
