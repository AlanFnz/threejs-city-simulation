export function residentSpread(id: string): number {
  let hash = 0;
  for (const letter of id)
    hash = (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0;
  return (Math.imul(hash, 2654435761) >>> 0) / 2 ** 32;
}
