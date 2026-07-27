/**
 * Unlike CONFIG (frozen), this is deliberately mutable - milestone rewards
 * raise a zone type's cap permanently for the rest of the session.
 *
 * INDUSTRIAL starts (and should stay) at 1: there's currently only one
 * industrial model, so a higher cap would have nothing to render for the
 * extra levels. Don't wire a milestone reward to it.
 */
export type ZoneLevelCaps = Record<'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL', number>;

/** Referenced by both the mutable state below and a "New Game" reset (see
 * src/game/saveGame) - kept as one source of truth so the two can't drift. */
export const DEFAULT_ZONE_LEVEL_CAPS: ZoneLevelCaps = {
  RESIDENTIAL: 3,
  COMMERCIAL: 3,
  INDUSTRIAL: 1,
};

export const ZONE_LEVEL_CAPS: ZoneLevelCaps = { ...DEFAULT_ZONE_LEVEL_CAPS };
