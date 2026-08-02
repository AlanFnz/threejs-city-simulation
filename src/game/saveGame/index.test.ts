import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { City } from '../../city';
import { BUILDING_TYPE } from '../../city/building/constants';
import { DevelopmentState } from '../../city/building/attributes/development';
import { ResidentialZone } from '../../city/building/zones/residentialZone';
import { CommercialZone } from '../../city/building/zones/commercialZone';
import { ZONE_LEVEL_CAPS, DEFAULT_ZONE_LEVEL_CAPS } from '../../city/building/zones/zoneLevelCaps';
import { Citizen } from '../../city/citizen';
import { CITIZEN_STATE } from '../../city/citizen/constants';
import { MilestoneTracker } from '../milestones';
import { cityEvents } from '../../events';
import { serialize, deserialize } from '.';
import { blankSave } from './constants';
import { normalizeCityName } from '../cityName';

describe('saveGame - serialize/deserialize', () => {
  beforeEach(() => {
    cityEvents.clear();
  });

  afterEach(() => {
    Object.assign(ZONE_LEVEL_CAPS, DEFAULT_ZONE_LEVEL_CAPS);
  });

  it('round-trips money, upkeep discount, and zone level caps', () => {
    const city = new City(10);
    city.loadEconomyState({ money: 7777, upkeepDiscount: 0.81 });
    ZONE_LEVEL_CAPS.RESIDENTIAL = 4;
    const tracker = new MilestoneTracker(city);

    const data = serialize(city, tracker);

    // simulate a fresh session where the mutable singleton is back at default
    ZONE_LEVEL_CAPS.RESIDENTIAL = DEFAULT_ZONE_LEVEL_CAPS.RESIDENTIAL;
    const loadedCity = new City(10);
    const loadedTracker = new MilestoneTracker(loadedCity);

    deserialize(data, loadedCity, loadedTracker);

    expect(loadedCity.money).toBe(7777);
    expect(loadedCity.upkeepDiscount).toBeCloseTo(0.81);
    expect(ZONE_LEVEL_CAPS.RESIDENTIAL).toBe(4);
  });

  it('stores a normalized city name while remaining compatible with legacy saves', () => {
    const city = new City(10);
    const tracker = new MilestoneTracker(city);

    expect(serialize(city, tracker, '  Harbor Heights  ').cityName).toBe(
      'Harbor Heights'
    );
    expect(blankSave().cityName).toBe('My City');

    const legacySave = blankSave();
    delete legacySave.cityName;
    expect(normalizeCityName(legacySave.cityName)).toBe('My City');
    expect(() => deserialize(legacySave, city, tracker)).not.toThrow();
  });

  it('round-trips a developed zone exactly - no re-randomized style/rotation', () => {
    const city = new City(10);
    const tile = city.getTile(3, 3)!;
    tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const zone = tile.building as ResidentialZone;
    zone.development.state = DevelopmentState.DEVELOPED;
    zone.development.level = 2;
    const originalStyle = zone.style;
    const originalRotation = { ...zone.rotation };

    const tracker = new MilestoneTracker(city);
    const data = serialize(city, tracker);

    const loadedCity = new City(10);
    const loadedTracker = new MilestoneTracker(loadedCity);
    deserialize(data, loadedCity, loadedTracker);

    const loadedZone = loadedCity.getTile(3, 3)!.building as ResidentialZone;
    expect(loadedZone.style).toBe(originalStyle);
    expect(loadedZone.rotation).toEqual(originalRotation);
    expect(loadedZone.development.state).toBe(DevelopmentState.DEVELOPED);
    expect(loadedZone.development.level).toBe(2);
  });

  it('round-trips a resident and a separately-employed citizen, including workplace linkage', () => {
    const city = new City(10);
    const homeTile = city.getTile(1, 1)!;
    homeTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    const home = homeTile.building as ResidentialZone;

    const jobTile = city.getTile(5, 5)!;
    jobTile.placeBuilding(BUILDING_TYPE.COMMERCIAL);
    const job = jobTile.building as CommercialZone;
    job.development.state = DevelopmentState.DEVELOPED;

    const citizen = new Citizen(home);
    home.residents.restore([citizen]);
    job.jobs.hire(citizen);
    citizen.workplace = job;
    citizen.state = CITIZEN_STATE.EMPLOYED;

    const tracker = new MilestoneTracker(city);
    const data = serialize(city, tracker);

    const loadedCity = new City(10);
    const loadedTracker = new MilestoneTracker(loadedCity);
    deserialize(data, loadedCity, loadedTracker);

    const loadedHome = loadedCity.getTile(1, 1)!.building as ResidentialZone;
    const loadedJob = loadedCity.getTile(5, 5)!.building as CommercialZone;

    expect(loadedHome.residents.count).toBe(1);
    const loadedCitizen = loadedHome.residents.all[0];
    expect(loadedCitizen.id).toBe(citizen.id);
    expect(loadedCitizen.firstName).toBe(citizen.firstName);
    expect(loadedCitizen.workplace).toBe(loadedJob);
    expect(loadedJob.jobs.filledJobs).toBe(1);
    expect(loadedJob.jobs.workers[0].id).toBe(citizen.id);
  });

  it('round-trips milestone progress without re-firing reward side effects', () => {
    const city = new City(10);
    const tracker = new MilestoneTracker(city);
    (tracker as unknown as { complete: (m: unknown) => void }).complete({
      id: 'pop-10',
      title: 'Reach 10 residents',
      condition: { type: 'population', atLeast: 10 },
      reward: { type: 'cash', amount: 2000 },
    });

    const data = serialize(city, tracker);

    const loadedCity = new City(10);
    const loadedTracker = new MilestoneTracker(loadedCity);
    const earnSpy = vi.spyOn(loadedCity, 'earn');

    deserialize(data, loadedCity, loadedTracker);

    expect(loadedTracker.isCompleted('pop-10')).toBe(true);
    // the post-load simulate() pass legitimately calls earn(income) as part
    // of ordinary tax collection (even earn(0) on an empty city) - what
    // must NOT happen is the milestone's own $2000 reward firing again
    expect(earnSpy).not.toHaveBeenCalledWith(2000);
  });

  it('ignores saved tiles that fall outside the loaded city bounds', () => {
    const data = blankSave();
    data.tiles.push({ x: 999, y: 999, buildingType: BUILDING_TYPE.ROAD });

    const city = new City(10);
    const tracker = new MilestoneTracker(city);

    expect(() => deserialize(data, city, tracker)).not.toThrow();
  });
});
