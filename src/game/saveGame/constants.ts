import { BuildingType } from '../../city/building/constants';
import { DevelopmentState } from '../../city/building/attributes/development';
import { CitizenState } from '../../city/citizen/constants';
import { DEFAULT_ZONE_LEVEL_CAPS } from '../../city/building/zones/zoneLevelCaps';
import { STARTING_UNLOCKED_TOOLS } from '../milestones';
import CONFIG from '../../config';
import { DEFAULT_CITY_NAME } from '../cityName';

export interface SavedCitizen {
  id: string;
  firstName: string;
  surname: string;
  age: number;
  state: CitizenState;
  /** tile coordinates of the employer zone, resolved after every zone exists */
  workplace?: { x: number; y: number };
}

export interface SavedTile {
  x: number;
  y: number;
  buildingType: BuildingType;
  /** zone-only fields below - a one-time random roll at construction that
   * would otherwise re-randomize on load (see Zone.style/rotation) */
  style?: string;
  rotation?: { x: number; y: number };
  developmentState?: DevelopmentState;
  developmentLevel?: number;
  developmentMaxLevel?: number;
  /** ResidentialZone only */
  residents?: SavedCitizen[];
}

export interface SaveGameV1 {
  version: 1;
  /** Optional so saves created before city naming remain loadable. */
  cityName?: string;
  money: number;
  upkeepDiscount: number;
  zoneLevelCaps: { RESIDENTIAL: number; COMMERCIAL: number; INDUSTRIAL: number };
  milestones: { completed: string[]; unlockedToolIds: string[] };
  tiles: SavedTile[];
}

export const SAVE_KEY = 'threejs-city-simulation/save';

export function blankSave(): SaveGameV1 {
  return {
    version: 1,
    cityName: DEFAULT_CITY_NAME,
    money: CONFIG.ECONOMY.STARTING_MONEY,
    upkeepDiscount: 1,
    zoneLevelCaps: { ...DEFAULT_ZONE_LEVEL_CAPS },
    milestones: { completed: [], unlockedToolIds: [...STARTING_UNLOCKED_TOOLS] },
    tiles: [],
  };
}
