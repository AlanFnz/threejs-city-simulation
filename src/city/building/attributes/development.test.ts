import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevelopmentState } from './development';
import { ResidentialZone } from '../zones/residentialZone';
import { IndustrialZone } from '../zones/industrialZone';
import { ICity } from '../..';
import CONFIG from '../../../config';
import { random } from '../../../utils/rng';

vi.mock('../../../utils/rng', () => ({ random: vi.fn() }));

const mockedRandom = vi.mocked(random);

function cityWithRoadAccess(hasAccess: boolean): ICity {
  return {
    getTile: () => ({ roadAccess: { value: hasAccess } }),
  } as unknown as ICity;
}

function advanceThroughConstruction(
  zone: ResidentialZone | IndustrialZone,
  city: ICity
) {
  zone.development.simulate(city); // UNDEVELOPED -> UNDER_CONSTRUCTION
  for (let i = 0; i < CONFIG.ZONE.CONSTRUCTION_TIME; i++) {
    zone.development.simulate(city); // -> DEVELOPED after CONSTRUCTION_TIME steps
  }
}

describe('DevelopmentAttribute', () => {
  beforeEach(() => {
    mockedRandom.mockReset();
  });

  it('stays undeveloped without road access, even on a favorable roll', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    zone.development.simulate(cityWithRoadAccess(false));
    expect(zone.development.state).toBe(DevelopmentState.UNDEVELOPED);
  });

  it('does not start construction on an unfavorable roll', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(CONFIG.ZONE.REDEVELOP_CHANCE + 0.01);
    zone.development.simulate(cityWithRoadAccess(true));
    expect(zone.development.state).toBe(DevelopmentState.UNDEVELOPED);
  });

  it('starts and finishes construction, reaching level 1', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    advanceThroughConstruction(zone, cityWithRoadAccess(true));
    expect(zone.development.state).toBe(DevelopmentState.DEVELOPED);
    expect(zone.development.level).toBe(1);
  });

  it('levels up while developed, up to its maxLevel', () => {
    const zone = new ResidentialZone(0, 0); // maxLevel 3
    mockedRandom.mockReturnValue(0); // always-favorable roll
    const city = cityWithRoadAccess(true);
    advanceThroughConstruction(zone, city);

    for (let i = 0; i < 10; i++) zone.development.simulate(city);

    expect(zone.development.level).toBe(3);
  });

  it('caps industrial zones at level 1 regardless of favorable rolls', () => {
    const zone = new IndustrialZone(0, 0); // maxLevel 1
    mockedRandom.mockReturnValue(0);
    const city = cityWithRoadAccess(true);
    advanceThroughConstruction(zone, city);

    for (let i = 0; i < 10; i++) zone.development.simulate(city);

    expect(zone.development.level).toBe(1);
  });

  it('abandons a developed zone once cut off past the abandonment threshold', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    advanceThroughConstruction(zone, cityWithRoadAccess(true));
    expect(zone.development.state).toBe(DevelopmentState.DEVELOPED);

    const disconnected = cityWithRoadAccess(false);
    for (let i = 0; i <= CONFIG.ZONE.ABANDONMENT_THRESHOLD; i++) {
      zone.development.simulate(disconnected);
    }

    expect(zone.development.state).toBe(DevelopmentState.ABANDONED);
  });

  it('redevelops an abandoned zone once road access returns', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    const connected = cityWithRoadAccess(true);
    advanceThroughConstruction(zone, connected);

    const disconnected = cityWithRoadAccess(false);
    for (let i = 0; i <= CONFIG.ZONE.ABANDONMENT_THRESHOLD; i++) {
      zone.development.simulate(disconnected);
    }
    expect(zone.development.state).toBe(DevelopmentState.ABANDONED);

    zone.development.simulate(connected);
    expect(zone.development.state).toBe(DevelopmentState.DEVELOPED);
  });
});
