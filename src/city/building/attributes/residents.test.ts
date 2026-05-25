import { describe, it, expect } from 'vitest';
import { ResidentialZone } from '../zones/residentialZone';
import CONFIG from '../../../config';

describe('ResidentsAttribute.maximum', () => {
  it('scales exponentially with development level', () => {
    const zone = new ResidentialZone(0, 0);

    zone.development.level = 1;
    expect(zone.residents.maximum).toBe(CONFIG.ZONE.MAX_RESIDENTS ** 1);

    zone.development.level = 2;
    expect(zone.residents.maximum).toBe(CONFIG.ZONE.MAX_RESIDENTS ** 2);

    zone.development.level = 3;
    expect(zone.residents.maximum).toBe(CONFIG.ZONE.MAX_RESIDENTS ** 3);
  });
});
