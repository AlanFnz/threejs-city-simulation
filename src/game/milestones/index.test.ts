import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MilestoneTracker } from '.';
import { ICity } from '../../city';
import { City } from '../../city';
import { BUILDING_TYPE } from '../../city/building/constants';
import { DevelopmentState } from '../../city/building/attributes/development';
import { CommercialZone } from '../../city/building/zones/commercialZone';
import { IndustrialZone } from '../../city/building/zones/industrialZone';
import { ResidentialZone } from '../../city/building/zones/residentialZone';
import { ZONE_LEVEL_CAPS } from '../../city/building/zones/zoneLevelCaps';
import { cityEvents } from '../../events';

function fakeCity(overrides: { population?: number; money?: number } = {}): ICity {
  return {
    population: overrides.population ?? 0,
    money: overrides.money ?? 0,
    size: 0,
    getTile: vi.fn(() => null),
    earn: vi.fn(),
    applyUpkeepDiscount: vi.fn(),
  } as unknown as ICity;
}

describe('MilestoneTracker - population/money milestones', () => {
  beforeEach(() => {
    cityEvents.clear();
  });

  it('does not complete the pop-10 milestone before population reaches 10', () => {
    const city = fakeCity({ population: 9 });
    const tracker = new MilestoneTracker(city);

    cityEvents.emit('citizenMovedIn', { citizenId: '1', x: 0, y: 0 });

    expect(tracker.isCompleted('pop-10')).toBe(false);
    expect(city.earn).not.toHaveBeenCalled();
  });

  it('awards the pop-10 cash bonus exactly once population reaches 10', () => {
    const city = fakeCity({ population: 10 });
    const tracker = new MilestoneTracker(city);

    cityEvents.emit('citizenMovedIn', { citizenId: '1', x: 0, y: 0 });

    expect(tracker.isCompleted('pop-10')).toBe(true);
    expect(city.earn).toHaveBeenCalledWith(2000);
    expect(city.earn).toHaveBeenCalledTimes(1);

    // a second event shouldn't re-award it
    cityEvents.emit('citizenMovedIn', { citizenId: '2', x: 0, y: 0 });
    expect(city.earn).toHaveBeenCalledTimes(1);
  });

  it('unlocks COMMERCIAL and INDUSTRIAL from the start, with no milestone required', () => {
    const city = fakeCity({ population: 0 });
    const tracker = new MilestoneTracker(city);

    expect(tracker.isUnlocked(BUILDING_TYPE.COMMERCIAL)).toBe(true);
    expect(tracker.isUnlocked(BUILDING_TYPE.INDUSTRIAL)).toBe(true);
  });

  it('unlocks the four civic buildings as population crosses their thresholds', () => {
    const city = fakeCity({ population: 5 });
    const tracker = new MilestoneTracker(city);

    expect(tracker.isUnlocked(BUILDING_TYPE.FIRE_STATION)).toBe(false);
    expect(tracker.isUnlocked(BUILDING_TYPE.POLICE_STATION)).toBe(false);
    expect(tracker.isUnlocked(BUILDING_TYPE.HOSPITAL)).toBe(false);
    expect(tracker.isUnlocked(BUILDING_TYPE.SCHOOL)).toBe(false);

    (city as { population: number }).population = 15;
    cityEvents.emit('citizenMovedIn', { citizenId: '1', x: 0, y: 0 });
    expect(tracker.isUnlocked(BUILDING_TYPE.FIRE_STATION)).toBe(true);
    expect(tracker.isUnlocked(BUILDING_TYPE.POLICE_STATION)).toBe(false);

    (city as { population: number }).population = 25;
    cityEvents.emit('citizenMovedIn', { citizenId: '2', x: 0, y: 0 });
    expect(tracker.isUnlocked(BUILDING_TYPE.POLICE_STATION)).toBe(true);
    expect(tracker.isUnlocked(BUILDING_TYPE.HOSPITAL)).toBe(false);

    (city as { population: number }).population = 40;
    cityEvents.emit('citizenMovedIn', { citizenId: '3', x: 0, y: 0 });
    expect(tracker.isUnlocked(BUILDING_TYPE.HOSPITAL)).toBe(true);
    expect(tracker.isUnlocked(BUILDING_TYPE.SCHOOL)).toBe(false);

    (city as { population: number }).population = 60;
    cityEvents.emit('citizenMovedIn', { citizenId: '4', x: 0, y: 0 });
    expect(tracker.isUnlocked(BUILDING_TYPE.SCHOOL)).toBe(true);
  });

  it('applies the upkeep discount once the money milestone is reached', () => {
    const city = fakeCity({ money: 25000 });
    const tracker = new MilestoneTracker(city);

    cityEvents.emit('moneyChanged', { amount: 100, balance: 25000 });

    expect(tracker.isCompleted('money-25000')).toBe(true);
    expect(city.applyUpkeepDiscount).toHaveBeenCalledWith(0.9);
  });

  it('restoreState never re-locks a tool that STARTING_UNLOCKED_TOOLS guarantees, even from an older save', () => {
    const city = fakeCity();
    const tracker = new MilestoneTracker(city);

    // simulates a save written before COMMERCIAL/INDUSTRIAL were always
    // unlocked - it simply never recorded them.
    tracker.restoreState({
      completed: [],
      unlockedToolIds: ['SELECT', 'RESIDENTIAL', 'ROAD', 'POWER_PLANT', 'POWER_LINE', 'BULLDOZE'],
    });

    expect(tracker.isUnlocked(BUILDING_TYPE.COMMERCIAL)).toBe(true);
    expect(tracker.isUnlocked(BUILDING_TYPE.INDUSTRIAL)).toBe(true);
  });

  it('does not re-check population milestones on a moneyChanged event', () => {
    const city = fakeCity({ population: 10, money: 0 });
    new MilestoneTracker(city);

    cityEvents.emit('moneyChanged', { amount: 0, balance: 0 });

    // population condition never got a chance to run - earn shouldn't fire
    expect(city.earn).not.toHaveBeenCalled();
  });
});

describe('MilestoneTracker - developed zone count milestones', () => {
  const defaultCaps = { ...ZONE_LEVEL_CAPS };

  beforeEach(() => {
    cityEvents.clear();
  });

  afterEach(() => {
    Object.assign(ZONE_LEVEL_CAPS, defaultCaps);
  });

  it('raises the residential zone level cap once 5 commercial zones are developed, retroactively and for future zones', () => {
    const city = new City(20);
    new MilestoneTracker(city);

    const existingResidential = city.getTile(0, 0)!;
    existingResidential.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    expect(existingResidential.building?.type).toBe(BUILDING_TYPE.RESIDENTIAL);

    for (let i = 0; i < 5; i++) {
      const tile = city.getTile(1 + i, 0)!;
      tile.placeBuilding(BUILDING_TYPE.COMMERCIAL);
      (tile.building as CommercialZone).development.state = DevelopmentState.DEVELOPED;
    }

    expect(ZONE_LEVEL_CAPS.RESIDENTIAL).toBe(4);
    expect((existingResidential.building as ResidentialZone).development.maxLevel).toBe(4);

    const newResidential = city.getTile(0, 1)!;
    newResidential.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    expect((newResidential.building as ResidentialZone).development.maxLevel).toBe(4);
  });

  it('raises the commercial zone level cap once 5 industrial zones are developed', () => {
    const city = new City(20);
    new MilestoneTracker(city);

    for (let i = 0; i < 5; i++) {
      const tile = city.getTile(i, 0)!;
      tile.placeBuilding(BUILDING_TYPE.INDUSTRIAL);
      (tile.building as IndustrialZone).development.state = DevelopmentState.DEVELOPED;
    }

    expect(ZONE_LEVEL_CAPS.COMMERCIAL).toBe(4);
  });

  it('does not count undeveloped zones toward the threshold', () => {
    const city = new City(20);
    const tracker = new MilestoneTracker(city);

    for (let i = 0; i < 5; i++) {
      city.getTile(i, 0)!.placeBuilding(BUILDING_TYPE.COMMERCIAL);
    }

    expect(tracker.isCompleted('commercial-5')).toBe(false);
    expect(ZONE_LEVEL_CAPS.RESIDENTIAL).toBe(defaultCaps.RESIDENTIAL);
  });
});
