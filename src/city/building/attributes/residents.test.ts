import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResidentialZone } from '../zones/residentialZone';
import { DevelopmentState } from './development';
import { ICity } from '../..';
import CONFIG from '../../../config';
import { random } from '../../../utils/rng';
import { cityEvents } from '../../../events';

vi.mock('../../../utils/rng', () => ({ random: vi.fn() }));

const mockedRandom = vi.mocked(random);

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

describe('ResidentsAttribute move-in', () => {
  beforeEach(() => {
    mockedRandom.mockReset();
    cityEvents.clear();
  });

  it('emits citizenMovedIn when a new resident moves in', () => {
    const zone = new ResidentialZone(4, 6);
    zone.development.state = DevelopmentState.DEVELOPED;
    // 0 satisfies the move-in chance roll and yields age 1 (SCHOOL),
    // so the new citizen's own step() is a no-op and doesn't need a real city.
    mockedRandom.mockReturnValue(0);
    const listener = vi.fn();
    cityEvents.on('citizenMovedIn', listener);

    zone.residents.update({} as ICity);

    expect(zone.residents.count).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      citizenId: expect.any(String),
      x: 4,
      y: 6,
    });
  });
});
