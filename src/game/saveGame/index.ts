import { ICity } from '../../city';
import { Zone } from '../../city/building/zones/zone';
import { ResidentialZone } from '../../city/building/zones/residentialZone';
import { CommercialZone } from '../../city/building/zones/commercialZone';
import { IndustrialZone } from '../../city/building/zones/industrialZone';
import { ZONE_LEVEL_CAPS } from '../../city/building/zones/zoneLevelCaps';
import { Citizen } from '../../city/citizen';
import { MilestoneTracker } from '../milestones';
import { SaveGameV1, SavedTile } from './constants';
import { DEFAULT_CITY_NAME, normalizeCityName } from '../cityName';

export { SAVE_KEY, blankSave } from './constants';
export type { SaveGameV1 } from './constants';

export function serialize(
  city: ICity,
  milestoneTracker: MilestoneTracker,
  cityName: string = DEFAULT_CITY_NAME
): SaveGameV1 {
  const tiles: SavedTile[] = [];

  for (let x = 0; x < city.size; x++) {
    for (let y = 0; y < city.size; y++) {
      const building = city.getTile(x, y)?.building;
      if (!building) continue;

      const saved: SavedTile = { x, y, buildingType: building.type };

      if (building instanceof Zone) {
        saved.style = building.style;
        saved.rotation = building.rotation;
        saved.developmentState = building.development.state;
        saved.developmentLevel = building.development.level;
        saved.developmentMaxLevel = building.development.maxLevel;
      }

      if (building instanceof ResidentialZone) {
        saved.residents = building.residents.all.map((citizen) => ({
          id: citizen.id,
          firstName: citizen.firstName,
          surname: citizen.surname,
          age: citizen.age,
          state: citizen.state,
          workplace: citizen.workplace
            ? { x: citizen.workplace.x, y: citizen.workplace.y }
            : undefined,
        }));
      }

      tiles.push(saved);
    }
  }

  return {
    version: 1,
    cityName: normalizeCityName(cityName),
    money: city.money,
    upkeepDiscount: city.upkeepDiscount,
    zoneLevelCaps: { ...ZONE_LEVEL_CAPS },
    milestones: milestoneTracker.getState(),
    tiles,
  };
}

/**
 * Replays a save through the same public APIs normal play uses
 * (placeBuilding, development.state, jobs.hire) rather than a private bulk
 * poke - developmentStateChanged/buildingPlaced/etc. all still fire, so
 * MilestoneTracker's and RandomEventsSystem's own incremental trackers
 * rebuild themselves as a side effect instead of needing a bespoke restore
 * path (their idempotent guards make the redundant re-checks harmless).
 */
export function deserialize(
  data: SaveGameV1,
  city: ICity,
  milestoneTracker: MilestoneTracker
): void {
  for (let x = 0; x < city.size; x++) {
    for (let y = 0; y < city.size; y++) {
      const tile = city.getTile(x, y);
      if (tile?.building) tile.removeBuilding();
    }
  }

  ZONE_LEVEL_CAPS.RESIDENTIAL = data.zoneLevelCaps.RESIDENTIAL;
  ZONE_LEVEL_CAPS.COMMERCIAL = data.zoneLevelCaps.COMMERCIAL;
  ZONE_LEVEL_CAPS.INDUSTRIAL = data.zoneLevelCaps.INDUSTRIAL;
  city.loadEconomyState({ money: data.money, upkeepDiscount: data.upkeepDiscount });
  milestoneTracker.restoreState(data.milestones);

  const employmentQueue: { citizen: Citizen; workplace: { x: number; y: number } }[] = [];

  for (const savedTile of data.tiles) {
    const tile = city.getTile(savedTile.x, savedTile.y);
    if (!tile) continue;

    tile.placeBuilding(savedTile.buildingType);
    const building = tile.building;
    if (!building) continue;

    if (building instanceof Zone) {
      if (savedTile.style !== undefined) building.style = savedTile.style;
      if (savedTile.rotation !== undefined) building.rotation = savedTile.rotation;
      if (savedTile.developmentMaxLevel !== undefined) {
        building.development.maxLevel = savedTile.developmentMaxLevel;
      }
      if (savedTile.developmentState !== undefined) {
        building.development.state = savedTile.developmentState;
      }
      if (savedTile.developmentLevel !== undefined) {
        building.development.level = savedTile.developmentLevel;
      }
    }

    if (building instanceof ResidentialZone && savedTile.residents) {
      const citizens = savedTile.residents.map((saved) => {
        const citizen = new Citizen(building, {
          id: saved.id,
          firstName: saved.firstName,
          surname: saved.surname,
          age: saved.age,
          state: saved.state,
        });
        if (saved.workplace) employmentQueue.push({ citizen, workplace: saved.workplace });
        return citizen;
      });
      building.residents.restore(citizens);
    }
  }

  for (const { citizen, workplace } of employmentQueue) {
    const workplaceBuilding = city.getTile(workplace.x, workplace.y)?.building;
    if (workplaceBuilding instanceof CommercialZone || workplaceBuilding instanceof IndustrialZone) {
      workplaceBuilding.jobs.hire(citizen);
      citizen.workplace = workplaceBuilding;
    }
  }

  // Road styles are recomputed each simulate() pass, not on placement - one
  // extra tick here just fixes them up immediately instead of waiting up to
  // 1s for the next natural tick (an acceptable one-tick-early economy/growth
  // pass, not worth special-casing around).
  city.simulate();
}
