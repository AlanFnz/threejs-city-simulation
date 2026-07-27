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

    zone.residents.update({ getTile: () => null } as unknown as ICity);

    expect(zone.residents.count).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      citizenId: expect.any(String),
      x: 4,
      y: 6,
    });
  });

  it('moves in on a roll that would fail without Hospital coverage', () => {
    const zone = new ResidentialZone(4, 6);
    zone.development.state = DevelopmentState.DEVELOPED;

    // between RESIDENT_MOVE_IN_CHANCE and RESIDENT_MOVE_IN_CHANCE *
    // MOVE_IN_CHANCE_MULTIPLIER - fails uncovered, succeeds covered.
    // findTile is stubbed since this roll can land a working-age citizen,
    // whose own step() would otherwise look for a job against a real city.
    const midRoll =
      (CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE +
        CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE * CONFIG.CIVIC_SERVICES.HOSPITAL.MOVE_IN_CHANCE_MULTIPLIER) /
      2;
    mockedRandom.mockReturnValue(midRoll);

    zone.residents.update({ getTile: () => null, findTile: () => null } as unknown as ICity);
    expect(zone.residents.count).toBe(0);

    zone.residents.update({
      getTile: () => ({ hospitalCoverage: { value: true } }),
      findTile: () => null,
    } as unknown as ICity);
    expect(zone.residents.count).toBe(1);
  });
});

describe('ResidentsAttribute.evictAll', () => {
  beforeEach(() => {
    mockedRandom.mockReset();
    cityEvents.clear();
  });

  it('clears the roster before emitting, so listeners see the post-eviction count', () => {
    const zone = new ResidentialZone(2, 3);
    zone.development.state = DevelopmentState.DEVELOPED;
    mockedRandom.mockReturnValue(0); // move-in roll + SCHOOL-age citizen
    zone.residents.update({ getTile: () => null } as unknown as ICity);
    expect(zone.residents.count).toBe(1);

    let countDuringEmit = -1;
    cityEvents.on('citizenMovedOut', () => {
      countDuringEmit = zone.residents.count;
    });

    zone.residents.evictAll();

    expect(countDuringEmit).toBe(0);
  });

  it('emits citizenMovedOut once per evicted resident', () => {
    const zone = new ResidentialZone(2, 3);
    zone.development.state = DevelopmentState.DEVELOPED;
    mockedRandom.mockReturnValue(0);
    zone.residents.update({ getTile: () => null } as unknown as ICity); // one resident moves in
    const listener = vi.fn();
    cityEvents.on('citizenMovedOut', listener);

    zone.residents.evictAll();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      citizenId: expect.any(String),
      x: 2,
      y: 3,
    });
  });

  it('emits nothing when there are no residents to evict', () => {
    const zone = new ResidentialZone(0, 0);
    const listener = vi.fn();
    cityEvents.on('citizenMovedOut', listener);

    zone.residents.evictAll();

    expect(listener).not.toHaveBeenCalled();
  });
});
