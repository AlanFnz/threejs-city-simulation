/**
 * Unlike CONFIG (frozen), this is deliberately mutable - milestone rewards
 * raise a zone type's cap permanently for the rest of the session.
 *
 * INDUSTRIAL starts (and should stay) at 1: there's currently only one
 * industrial model, so a higher cap would have nothing to render for the
 * extra levels. Don't wire a milestone reward to it.
 */
export const ZONE_LEVEL_CAPS: Record<'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL', number> = {
  RESIDENTIAL: 3,
  COMMERCIAL: 3,
  INDUSTRIAL: 1,
};
