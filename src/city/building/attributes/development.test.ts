import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevelopmentState } from './development';
import { ResidentialZone } from '../zones/residentialZone';
import { IndustrialZone } from '../zones/industrialZone';
import { ICity } from '../..';
import CONFIG from '../../../config';
import { random } from '../../../utils/rng';
import { cityEvents } from '../../../events';

vi.mock('../../../utils/rng', () => ({ random: vi.fn() }));

const mockedRandom = vi.mocked(random);

function mockCity(hasRoadAccess: boolean, hasPowerAccess: boolean = true): ICity {
  return {
    getTile: () => ({
      roadAccess: { value: hasRoadAccess },
      powerAccess: { value: hasPowerAccess },
    }),
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
    cityEvents.clear();
  });

  it('stays undeveloped without road access, even on a favorable roll', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    zone.development.simulate(mockCity(false));
    expect(zone.development.state).toBe(DevelopmentState.UNDEVELOPED);
  });

  it('does not start construction on an unfavorable roll', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(CONFIG.ZONE.REDEVELOP_CHANCE + 0.01);
    zone.development.simulate(mockCity(true));
    expect(zone.development.state).toBe(DevelopmentState.UNDEVELOPED);
  });

  it('starts and finishes construction, reaching level 1', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    advanceThroughConstruction(zone, mockCity(true));
    expect(zone.development.state).toBe(DevelopmentState.DEVELOPED);
    expect(zone.development.level).toBe(1);
  });

  it('levels up while developed, up to its maxLevel', () => {
    const zone = new ResidentialZone(0, 0); // maxLevel 3
    mockedRandom.mockReturnValue(0); // always-favorable roll
    const city = mockCity(true);
    advanceThroughConstruction(zone, city);

    for (let i = 0; i < 10; i++) zone.development.simulate(city);

    expect(zone.development.level).toBe(3);
  });

  it('caps industrial zones at level 1 regardless of favorable rolls', () => {
    const zone = new IndustrialZone(0, 0); // maxLevel 1
    mockedRandom.mockReturnValue(0);
    const city = mockCity(true);
    advanceThroughConstruction(zone, city);

    for (let i = 0; i < 10; i++) zone.development.simulate(city);

    expect(zone.development.level).toBe(1);
  });

  it('abandons a developed zone once cut off past the abandonment threshold', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    advanceThroughConstruction(zone, mockCity(true));
    expect(zone.development.state).toBe(DevelopmentState.DEVELOPED);

    const disconnected = mockCity(false);
    for (let i = 0; i <= CONFIG.ZONE.ABANDONMENT_THRESHOLD; i++) {
      zone.development.simulate(disconnected);
    }

    expect(zone.development.state).toBe(DevelopmentState.ABANDONED);
  });

  it('redevelops an abandoned zone once road access returns', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    const connected = mockCity(true);
    advanceThroughConstruction(zone, connected);

    const disconnected = mockCity(false);
    for (let i = 0; i <= CONFIG.ZONE.ABANDONMENT_THRESHOLD; i++) {
      zone.development.simulate(disconnected);
    }
    expect(zone.development.state).toBe(DevelopmentState.ABANDONED);

    zone.development.simulate(connected);
    expect(zone.development.state).toBe(DevelopmentState.DEVELOPED);
  });

  it('emits developmentStateChanged only when the state actually changes', () => {
    const zone = new ResidentialZone(5, 7);
    const listener = vi.fn();
    cityEvents.on('developmentStateChanged', listener);
    mockedRandom.mockReturnValue(CONFIG.ZONE.REDEVELOP_CHANCE + 0.01);

    zone.development.simulate(mockCity(true)); // unfavorable roll, no transition
    expect(listener).not.toHaveBeenCalled();

    mockedRandom.mockReturnValue(0);
    zone.development.simulate(mockCity(true)); // UNDEVELOPED -> UNDER_CONSTRUCTION

    expect(listener).toHaveBeenCalledWith({
      x: 5,
      y: 7,
      state: DevelopmentState.UNDER_CONSTRUCTION,
      previousState: DevelopmentState.UNDEVELOPED,
    });
  });

  it('emits levelChanged when the level actually increases', () => {
    const zone = new ResidentialZone(1, 2);
    mockedRandom.mockReturnValue(0);
    advanceThroughConstruction(zone, mockCity(true));

    const listener = vi.fn();
    cityEvents.on('levelChanged', listener);
    zone.development.simulate(mockCity(true)); // level 1 -> 2

    expect(listener).toHaveBeenCalledWith({
      x: 1,
      y: 2,
      level: 2,
      previousLevel: 1,
    });
  });

  it('stays undeveloped without power access, even with road access and a favorable roll', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    zone.development.simulate(mockCity(true, false));
    expect(zone.development.state).toBe(DevelopmentState.UNDEVELOPED);
  });

  it('abandons a developed zone once cut off from power, despite road access', () => {
    const zone = new ResidentialZone(0, 0);
    mockedRandom.mockReturnValue(0);
    advanceThroughConstruction(zone, mockCity(true));
    expect(zone.development.state).toBe(DevelopmentState.DEVELOPED);

    const noPower = mockCity(true, false);
    for (let i = 0; i <= CONFIG.ZONE.ABANDONMENT_THRESHOLD; i++) {
      zone.development.simulate(noPower);
    }

    expect(zone.development.state).toBe(DevelopmentState.ABANDONED);
  });
});
