import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RandomEventsSystem } from '.';
import { ICity } from '../../city';
import { City } from '../../city';
import { BUILDING_TYPE } from '../../city/building/constants';
import { DevelopmentState } from '../../city/building/attributes/development';
import { CommercialZone } from '../../city/building/zones/commercialZone';
import { ResidentialZone } from '../../city/building/zones/residentialZone';
import { Citizen } from '../../city/citizen';
import { cityEvents } from '../../events';
import { random } from '../../utils/rng';
import CONFIG from '../../config';

vi.mock('../../utils/rng', () => ({ random: vi.fn() }));
const mockedRandom = vi.mocked(random);

interface PrivateSystem {
  tryWindfall(): boolean;
  tryFire(): boolean;
  tryLayoffs(): boolean;
}

function asPrivate(system: RandomEventsSystem): PrivateSystem {
  return system as unknown as PrivateSystem;
}

function fakeCity(overrides: { netIncome?: number } = {}): ICity {
  return {
    size: 20,
    netIncome: overrides.netIncome ?? 0,
    getTile: vi.fn(() => null),
    earn: vi.fn(),
  } as unknown as ICity;
}

describe('RandomEventsSystem - windfall', () => {
  beforeEach(() => {
    cityEvents.clear();
    mockedRandom.mockReset();
  });

  it('awards a windfall within the configured range when the roll succeeds, and stops before checking anything else', () => {
    const city = fakeCity();
    mockedRandom.mockReturnValue(0.001);
    const system = new RandomEventsSystem(city);
    const messages: string[] = [];
    cityEvents.on('randomEventTriggered', ({ message }) => messages.push(message));

    system.tick();

    expect(city.earn).toHaveBeenCalledTimes(1);
    const amount = vi.mocked(city.earn).mock.calls[0][0];
    expect(amount).toBeGreaterThanOrEqual(CONFIG.RANDOM_EVENTS.WINDFALL.MIN_AMOUNT);
    expect(amount).toBeLessThanOrEqual(CONFIG.RANDOM_EVENTS.WINDFALL.MAX_AMOUNT);
    expect(messages).toHaveLength(1);
  });

  it('does nothing when every roll fails', () => {
    const city = fakeCity();
    mockedRandom.mockReturnValue(0.999);
    const system = new RandomEventsSystem(city);

    system.tick();

    expect(city.earn).not.toHaveBeenCalled();
  });
});

describe('RandomEventsSystem - fire', () => {
  beforeEach(() => {
    cityEvents.clear();
    mockedRandom.mockReset();
  });

  it('forces a developed zone into ABANDONED when the roll succeeds', () => {
    const city = new City(20);
    const tile = city.getTile(5, 5)!;
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    (tile.building as ResidentialZone).development.state = DevelopmentState.DEVELOPED;

    mockedRandom.mockReturnValue(0.001);
    const system = new RandomEventsSystem(city);
    const messages: string[] = [];
    cityEvents.on('randomEventTriggered', ({ message }) => messages.push(message));

    const fired = asPrivate(system).tryFire();

    expect(fired).toBe(true);
    expect((tile.building as ResidentialZone).development.state).toBe(DevelopmentState.ABANDONED);
    expect(messages).toHaveLength(1);
  });

  it('is a no-op with no developed zones to target', () => {
    const city = new City(20);
    mockedRandom.mockReturnValue(0.001);
    const system = new RandomEventsSystem(city);

    expect(() => asPrivate(system).tryFire()).not.toThrow();
    expect(asPrivate(system).tryFire()).toBe(false);
  });

  it('increases the fire chance as more zones are already abandoned', () => {
    const city = new City(20);
    const tile = city.getTile(5, 5)!;
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    (tile.building as ResidentialZone).development.state = DevelopmentState.DEVELOPED;

    // a roll between BASE_CHANCE and BASE_CHANCE + CHANCE_PER_ABANDONED_ZONE
    // fails with zero abandoned zones, succeeds once one is already abandoned
    const { BASE_CHANCE, CHANCE_PER_ABANDONED_ZONE } = CONFIG.RANDOM_EVENTS.FIRE;
    const midRoll = BASE_CHANCE + CHANCE_PER_ABANDONED_ZONE / 2;
    mockedRandom.mockReturnValue(midRoll);
    const system = new RandomEventsSystem(city);

    expect(asPrivate(system).tryFire()).toBe(false);

    // mark another zone abandoned so the tracker's incremental count goes up
    const otherTile = city.getTile(6, 6)!;
    otherTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    (otherTile.building as ResidentialZone).development.state = DevelopmentState.ABANDONED;

    expect(asPrivate(system).tryFire()).toBe(true);
  });

  it('never targets a zone covered by a Fire Station', () => {
    const city = new City(20);
    city.getTile(4, 4)!.placeBuilding(BUILDING_TYPE.FIRE_STATION);
    const tile = city.getTile(5, 5)!;
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    (tile.building as ResidentialZone).development.state = DevelopmentState.DEVELOPED;
    expect(tile.fireStationCoverage?.value).toBe(true);

    mockedRandom.mockReturnValue(0.001);
    const system = new RandomEventsSystem(city);

    expect(asPrivate(system).tryFire()).toBe(false);
    expect((tile.building as ResidentialZone).development.state).toBe(DevelopmentState.DEVELOPED);
  });
});

describe('RandomEventsSystem - layoffs', () => {
  beforeEach(() => {
    cityEvents.clear();
    mockedRandom.mockReset();
  });

  it('lays off workers at a developed zone when the roll succeeds', () => {
    const city = new City(20);
    const homeTile = city.getTile(0, 0)!;
    homeTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    const jobTile = city.getTile(5, 5)!;
    jobTile.placeBuilding(BUILDING_TYPE.COMMERCIAL);
    const zone = jobTile.building as CommercialZone;
    zone.development.state = DevelopmentState.DEVELOPED;

    mockedRandom.mockReturnValue(0.001);
    const citizen = new Citizen(homeTile.building as ResidentialZone);
    zone.jobs.hire(citizen);
    expect(zone.jobs.filledJobs).toBe(1);

    const system = new RandomEventsSystem(city);
    const fired = asPrivate(system).tryLayoffs();

    expect(fired).toBe(true);
    expect(zone.jobs.filledJobs).toBe(0);
  });

  it('rolls at a higher chance while the city is running a deficit', () => {
    const { BASE_CHANCE, DEFICIT_MULTIPLIER } = CONFIG.RANDOM_EVENTS.LAYOFFS;
    // between BASE_CHANCE and BASE_CHANCE * DEFICIT_MULTIPLIER: fails on a
    // surplus, succeeds on a deficit, given no target exists either way -
    // isolates the chance check itself from target selection.
    const midRoll = BASE_CHANCE * ((1 + DEFICIT_MULTIPLIER) / 2);
    mockedRandom.mockReturnValue(midRoll);

    const surplusCity = fakeCity({ netIncome: 100 });
    expect(asPrivate(new RandomEventsSystem(surplusCity)).tryLayoffs()).toBe(false);

    const deficitCity = fakeCity({ netIncome: -100 });
    const deficitSystem = new RandomEventsSystem(deficitCity);
    // no target tiles exist on the fake city, so the roll succeeding still
    // resolves to false - this only proves the chance check passed the
    // higher threshold, not that a layoff actually landed.
    expect(deficitCity.getTile).not.toHaveBeenCalled();
    asPrivate(deficitSystem).tryLayoffs();
    expect(deficitCity.getTile).toHaveBeenCalled();
  });
});
