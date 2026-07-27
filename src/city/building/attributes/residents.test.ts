import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResidentialZone } from '../zones/residentialZone';
import { DevelopmentState } from './development';
import { ITile } from '../../tile';
import { ICity } from '../..';
import CONFIG from '../../../config';
import { random } from '../../../utils/rng';
import { cityEvents } from '../../../events';

vi.mock('../../../utils/rng', () => ({ random: vi.fn() }));

const mockedRandom = vi.mocked(random);

/** findTile defaults to "no jobs found nearby" - tests that care about job
 * availability override it explicitly. */
function fakeCity(overrides: {
  getTile?: () => unknown;
  findTile?: () => ITile | null;
} = {}): ICity {
  return {
    getTile: overrides.getTile ?? (() => null),
    findTile: overrides.findTile ?? (() => null),
  } as unknown as ICity;
}

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

    zone.residents.update(fakeCity());

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

    // Both branches here have no jobs nearby (findTile -> null), so both are
    // already scaled by NO_JOBS_MOVE_IN_MULTIPLIER - the roll only needs to
    // land between the (scaled) uncovered and covered chances.
    const midRoll =
      (CONFIG.ZONE.NO_JOBS_MOVE_IN_MULTIPLIER *
        (CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE +
          CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE * CONFIG.CIVIC_SERVICES.HOSPITAL.MOVE_IN_CHANCE_MULTIPLIER)) /
      2;
    mockedRandom.mockReturnValue(midRoll);

    zone.residents.update(fakeCity());
    expect(zone.residents.count).toBe(0);

    zone.residents.update(fakeCity({ getTile: () => ({ hospitalCoverage: { value: true } }) }));
    expect(zone.residents.count).toBe(1);
  });

  it('moves in far more readily when a nearby job is available than when none exists', () => {
    const zone = new ResidentialZone(4, 6);
    zone.development.state = DevelopmentState.DEVELOPED;

    // between the no-jobs-scaled chance and the full chance - fails with no
    // jobs nearby, succeeds once a job is reachable.
    const midRoll =
      (CONFIG.ZONE.NO_JOBS_MOVE_IN_MULTIPLIER * CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE +
        CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE) /
      2;
    mockedRandom.mockReturnValue(midRoll);

    zone.residents.update(fakeCity({ findTile: () => null }));
    expect(zone.residents.count).toBe(0);

    zone.residents.update(fakeCity({ findTile: () => ({} as ITile) }));
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
    zone.residents.update(fakeCity());
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
    zone.residents.update(fakeCity()); // one resident moves in
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
