import { describe, it, expect, beforeEach, vi } from 'vitest';
import { City } from '.';
import { BUILDING_TYPE } from './building/constants';
import CONFIG from '../config';
import { cityEvents } from '../events';
import { random } from '../utils/rng';

vi.mock('../utils/rng', () => ({ random: vi.fn() }));
const mockedRandom = vi.mocked(random);

describe('City.findTile', () => {
  it('finds a matching tile within range', () => {
    const city = new City(5);
    const target = city.getTile(2, 3)!;
    const found = city.findTile({ x: 0, y: 0 }, (tile) => tile === target, 10);
    expect(found).toBe(target);
  });

  it('returns null when no tile matches the filter', () => {
    const city = new City(5);
    const found = city.findTile({ x: 0, y: 0 }, () => false, 10);
    expect(found).toBeNull();
  });

  it('treats an otherwise-matching tile beyond maxDistance as unreachable', () => {
    const city = new City(5);
    const farTile = city.getTile(4, 4)!; // manhattan distance 8 from (0,0)
    const found = city.findTile({ x: 0, y: 0 }, (tile) => tile === farTile, 3);
    expect(found).toBeNull();
  });

  it('finds a match exactly at the distance cap', () => {
    const city = new City(5);
    const target = city.getTile(0, 3)!; // manhattan distance 3 from (0,0)
    const found = city.findTile({ x: 0, y: 0 }, (tile) => tile === target, 3);
    expect(found).toBe(target);
  });
});

describe('reactive road access', () => {
  const SEARCH_DISTANCE = CONFIG.ATTRIBUTES.ROAD_ACCESS.SEARCH_DISTANCE;

  beforeEach(() => {
    cityEvents.clear();
  });

  it('placing a road updates road access for a tile within range without a simulate() tick', () => {
    const city = new City(10);
    const nearTile = city.getTile(5, 5 - SEARCH_DISTANCE)!;
    expect(nearTile.roadAccess?.value).toBe(false);

    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.ROAD);

    expect(nearTile.roadAccess?.value).toBe(true);
  });

  it('placing a road does not affect a tile beyond SEARCH_DISTANCE', () => {
    const city = new City(10);
    const farTile = city.getTile(5, 5 - SEARCH_DISTANCE - 1)!;

    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.ROAD);

    expect(farTile.roadAccess?.value).toBe(false);
  });

  it('placing a non-road building next to an existing road picks up road access immediately', () => {
    const city = new City(10);
    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.ROAD);

    const zoneTile = city.getTile(5, 6)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(zoneTile.roadAccess?.value).toBe(true);
  });

  it('removing the only road in range clears road access for previously-in-range tiles', () => {
    const city = new City(10);
    const roadTile = city.getTile(5, 5)!;
    roadTile.placeBuilding(BUILDING_TYPE.ROAD);
    const nearTile = city.getTile(5, 6)!;
    expect(nearTile.roadAccess?.value).toBe(true);

    roadTile.removeBuilding();

    expect(nearTile.roadAccess?.value).toBe(false);
  });
});

describe('reactive power access', () => {
  const SEARCH_DISTANCE = CONFIG.ATTRIBUTES.POWER_ACCESS.SEARCH_DISTANCE;
  const CAPACITY = CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY;

  beforeEach(() => {
    cityEvents.clear();
  });

  it('placing a power plant updates power access for a zone within range without a simulate() tick', () => {
    const city = new City(20);
    const nearTile = city.getTile(10, 10 - SEARCH_DISTANCE)!;
    nearTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    expect(nearTile.powerAccess?.value).toBe(false);

    city.getTile(10, 10)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    expect(nearTile.powerAccess?.value).toBe(true);
  });

  it('placing a power plant does not affect a zone beyond SEARCH_DISTANCE', () => {
    const city = new City(20);
    const farTile = city.getTile(10, 10 - SEARCH_DISTANCE - 1)!;
    farTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    city.getTile(10, 10)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    expect(farTile.powerAccess?.value).toBe(false);
  });

  it('placing a zone next to an existing power plant picks up power access immediately', () => {
    const city = new City(20);
    city.getTile(10, 10)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const zoneTile = city.getTile(10, 11)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(zoneTile.powerAccess?.value).toBe(true);
  });

  it('removing the only power plant in range clears power access for previously-in-range zones', () => {
    const city = new City(20);
    const plantTile = city.getTile(10, 10)!;
    plantTile.placeBuilding(BUILDING_TYPE.POWER_PLANT);
    const zoneTile = city.getTile(10, 11)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    expect(zoneTile.powerAccess?.value).toBe(true);

    plantTile.removeBuilding();

    expect(zoneTile.powerAccess?.value).toBe(false);
  });

  it('caps the number of zones a single power plant can power at CAPACITY', () => {
    const city = new City(30);
    city.getTile(15, 15)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const zoneTiles = [];
    let placed = 0;
    for (let dx = -SEARCH_DISTANCE; dx <= SEARCH_DISTANCE && placed < CAPACITY + 5; dx++) {
      for (let dy = -SEARCH_DISTANCE; dy <= SEARCH_DISTANCE && placed < CAPACITY + 5; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (Math.abs(dx) + Math.abs(dy) > SEARCH_DISTANCE) continue;
        const tile = city.getTile(15 + dx, 15 + dy);
        if (!tile) continue;
        tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
        zoneTiles.push(tile);
        placed++;
      }
    }

    const poweredCount = zoneTiles.filter((t) => t.powerAccess?.value).length;
    expect(poweredCount).toBe(CAPACITY);
  });

  it('releases a plant slot when the powered zone is bulldozed, letting another zone take it', () => {
    const city = new City(20);
    city.getTile(10, 10)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const inRangeOffsets: { dx: number; dy: number }[] = [];
    for (let dx = -SEARCH_DISTANCE; dx <= SEARCH_DISTANCE; dx++) {
      for (let dy = -SEARCH_DISTANCE; dy <= SEARCH_DISTANCE; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (Math.abs(dx) + Math.abs(dy) > SEARCH_DISTANCE) continue;
        inRangeOffsets.push({ dx, dy });
      }
    }

    // fill capacity with the first CAPACITY tiles in range
    const zoneTiles = inRangeOffsets
      .slice(0, CAPACITY)
      .map(({ dx, dy }) => city.getTile(10 + dx, 10 + dy)!);
    zoneTiles.forEach((tile) => tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL));
    expect(zoneTiles.every((t) => t.powerAccess?.value)).toBe(true);

    // the next tile in range is unpowered - capacity is already full
    const { dx, dy } = inRangeOffsets[CAPACITY];
    const overflowTile = city.getTile(10 + dx, 10 + dy)!;
    overflowTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    expect(overflowTile.powerAccess?.value).toBe(false);

    zoneTiles[0].removeBuilding();

    expect(overflowTile.powerAccess?.value).toBe(true);
  });
});

describe('power lines', () => {
  const SEARCH_DISTANCE = CONFIG.ATTRIBUTES.POWER_ACCESS.SEARCH_DISTANCE;

  beforeEach(() => {
    cityEvents.clear();
  });

  it('powers a zone far beyond SEARCH_DISTANCE once a chain of power lines connects it to a plant', () => {
    const city = new City(30);
    city.getTile(10, 0)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const chainEnd = 10;
    for (let y = 1; y <= chainEnd; y++) {
      city.getTile(10, y)!.placeBuilding(BUILDING_TYPE.POWER_LINE);
    }

    const zoneTile = city.getTile(10, chainEnd + SEARCH_DISTANCE)!;
    expect(zoneTile.distanceTo(city.getTile(10, 0)!)).toBeGreaterThan(SEARCH_DISTANCE);

    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(zoneTile.powerAccess?.value).toBe(true);
  });

  it('does not power a zone near a power line stub that never reaches a plant', () => {
    const city = new City(30);

    const chainEnd = 10;
    for (let y = 1; y <= chainEnd; y++) {
      city.getTile(10, y)!.placeBuilding(BUILDING_TYPE.POWER_LINE);
    }

    const zoneTile = city.getTile(10, chainEnd + SEARCH_DISTANCE)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(zoneTile.powerAccess?.value).toBe(false);
  });

  it('cuts power to a zone when the line linking it to the network is removed', () => {
    const city = new City(30);
    city.getTile(10, 0)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const chainEnd = 10;
    for (let y = 1; y <= chainEnd; y++) {
      city.getTile(10, y)!.placeBuilding(BUILDING_TYPE.POWER_LINE);
    }

    const zoneTile = city.getTile(10, chainEnd + SEARCH_DISTANCE)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    expect(zoneTile.powerAccess?.value).toBe(true);

    city.getTile(10, chainEnd)!.removeBuilding();

    expect(zoneTile.powerAccess?.value).toBe(false);
  });

  it('lets a zone directly adjacent to a bare plant stay powered with no lines at all', () => {
    const city = new City(10);
    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const zoneTile = city.getTile(5, 6)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    expect(zoneTile.powerAccess?.value).toBe(true);
  });
});

describe('power relay through connected buildings', () => {
  const SEARCH_DISTANCE = CONFIG.ATTRIBUTES.POWER_ACCESS.SEARCH_DISTANCE;
  const CAPACITY = CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY;

  beforeEach(() => {
    cityEvents.clear();
  });

  it('powers a zone far beyond SEARCH_DISTANCE through a chain of adjacent powered zones, with no lines at all', () => {
    const city = new City(30);
    city.getTile(10, 0)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const chainEnd = SEARCH_DISTANCE + 4;
    for (let y = 1; y <= chainEnd; y++) {
      city.getTile(10, y)!.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    }

    const lastZone = city.getTile(10, chainEnd)!;
    expect(lastZone.distanceTo(city.getTile(10, 0)!)).toBeGreaterThan(SEARCH_DISTANCE);
    expect(lastZone.powerAccess?.value).toBe(true);
  });

  it('cascades power loss through the whole zone chain when the plant is removed', () => {
    const city = new City(30);
    const plantTile = city.getTile(10, 0)!;
    plantTile.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const chainEnd = SEARCH_DISTANCE + 4;
    for (let y = 1; y <= chainEnd; y++) {
      city.getTile(10, y)!.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
    }

    const lastZone = city.getTile(10, chainEnd)!;
    expect(lastZone.powerAccess?.value).toBe(true);

    plantTile.removeBuilding();

    expect(lastZone.powerAccess?.value).toBe(false);
  });

  it('still enforces plant CAPACITY across a daisy-chained cluster of zones', () => {
    const city = new City(50);
    city.getTile(10, 0)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);

    const zoneTiles = [];
    for (let y = 1; y <= CAPACITY + 5; y++) {
      const tile = city.getTile(10, y)!;
      tile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);
      zoneTiles.push(tile);
    }

    const poweredCount = zoneTiles.filter((t) => t.powerAccess?.value).length;
    expect(poweredCount).toBe(CAPACITY);
  });
});

describe('economy', () => {
  beforeEach(() => {
    cityEvents.clear();
  });

  it('starts at STARTING_MONEY', () => {
    const city = new City(5);
    expect(city.money).toBe(CONFIG.ECONOMY.STARTING_MONEY);
  });

  it('canAfford reflects the current balance', () => {
    const city = new City(5);
    expect(city.canAfford(CONFIG.ECONOMY.STARTING_MONEY)).toBe(true);
    expect(city.canAfford(CONFIG.ECONOMY.STARTING_MONEY + 1)).toBe(false);
  });

  it('spend deducts and emits moneyChanged when affordable', () => {
    const listener = vi.fn();
    cityEvents.on('moneyChanged', listener);
    const city = new City(5);

    const result = city.spend(100);

    expect(result).toBe(true);
    expect(city.money).toBe(CONFIG.ECONOMY.STARTING_MONEY - 100);
    expect(listener).toHaveBeenCalledWith({
      amount: -100,
      balance: CONFIG.ECONOMY.STARTING_MONEY - 100,
    });
  });

  it('spend rejects and leaves the balance untouched when unaffordable', () => {
    const city = new City(5);

    const result = city.spend(CONFIG.ECONOMY.STARTING_MONEY + 1);

    expect(result).toBe(false);
    expect(city.money).toBe(CONFIG.ECONOMY.STARTING_MONEY);
  });

  it('charges upkeep for infrastructure every simulate() tick', () => {
    const city = new City(10);
    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.ROAD);
    city.getTile(5, 6)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);
    city.getTile(5, 7)!.placeBuilding(BUILDING_TYPE.POWER_LINE);
    const balanceAfterBuilding = city.money;

    city.simulate();

    const expectedUpkeep =
      CONFIG.ECONOMY.UPKEEP.ROAD +
      CONFIG.ECONOMY.UPKEEP.POWER_PLANT +
      CONFIG.ECONOMY.UPKEEP.POWER_LINE;
    expect(city.money).toBeCloseTo(balanceAfterBuilding - expectedUpkeep);
  });

  it('charges no upkeep for a tile with no building', () => {
    const city = new City(5);
    const balance = city.money;

    city.simulate();

    expect(city.money).toBe(balance);
  });
});

describe('economy - tax income from developed zones', () => {
  beforeEach(() => {
    cityEvents.clear();
    mockedRandom.mockReset();
    mockedRandom.mockReturnValue(0); // always-favorable roll for every chance check
  });

  it('earns tax income per resident once a zone is developed and occupied', () => {
    const city = new City(10);
    city.getTile(5, 4)!.placeBuilding(BUILDING_TYPE.ROAD);
    city.getTile(5, 5)!.placeBuilding(BUILDING_TYPE.POWER_PLANT);
    const zoneTile = city.getTile(5, 6)!;
    zoneTile.placeBuilding(BUILDING_TYPE.RESIDENTIAL);

    // 1 tick UNDEVELOPED -> UNDER_CONSTRUCTION, then CONSTRUCTION_TIME ticks
    // to reach DEVELOPED (and, same tick, a favorable resident move-in roll)
    for (let i = 0; i <= CONFIG.ZONE.CONSTRUCTION_TIME; i++) {
      city.simulate();
    }

    const zone = zoneTile.building as unknown as {
      residents: { count: number };
    };
    expect(zone.residents.count).toBeGreaterThan(0);

    const balanceBeforeTax = city.money;
    city.simulate();

    const expectedUpkeep =
      CONFIG.ECONOMY.UPKEEP.ROAD + CONFIG.ECONOMY.UPKEEP.POWER_PLANT;
    const expectedIncome = zone.residents.count * CONFIG.ECONOMY.TAX_PER_RESIDENT;
    expect(city.money).toBeCloseTo(
      balanceBeforeTax + expectedIncome - expectedUpkeep
    );
  });
});
