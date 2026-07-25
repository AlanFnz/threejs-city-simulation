export interface Config {
  ATTRIBUTES: {
    ROAD_ACCESS: {
      /** tiles (Manhattan distance) a tile searches for a road */
      SEARCH_DISTANCE: number;
    };
    POWER_ACCESS: {
      /** tiles (Manhattan distance) a tile searches for a power plant */
      SEARCH_DISTANCE: number;
      /** number of zone tiles a single power plant can supply power to */
      CAPACITY: number;
    };
  };
  CITIZEN: {
    /** years */
    MIN_WORKING_AGE: number;
    /** years */
    RETIREMENT_AGE: number;
    /** tiles (Manhattan distance) a citizen searches for a job */
    MAX_JOB_SEARCH_DISTANCE: number;
  };
  ZONE: {
    /** probability per simulation tick, 0-1 */
    ABANDONMENT_CHANCE: number;
    /** probability per simulation tick, 0-1 */
    LEVEL_UP_CHANCE: number;
    /** probability per simulation tick, 0-1, of starting/resuming development */
    REDEVELOP_CHANCE: number;
    /** simulation ticks (~1s each) without road access before a zone is eligible for abandonment */
    ABANDONMENT_THRESHOLD: number;
    /** base of an exponential: MAX_RESIDENTS ^ level */
    MAX_RESIDENTS: number;
    /** base of an exponential: MAX_WORKERS ^ level */
    MAX_WORKERS: number;
    /** probability per simulation tick, 0-1 */
    RESIDENT_MOVE_IN_CHANCE: number;
    /** simulation ticks to finish construction */
    CONSTRUCTION_TIME: number;
  };
  CITY: {
    /** tiles per side */
    SIZE: number;
  };
  VEHICLE: {
    /** distance per millisecond */
    SPEED: number;
    /** milliseconds spent fading in/out at either end of a vehicle's life */
    FADE_TIME: number;
    /** milliseconds before a vehicle is removed regardless of route progress */
    MAX_LIFETIME: number;
    /** hard cap on vehicles in the scene at once */
    MAX_VEHICLE_COUNT: number;
    /** milliseconds between spawn attempts */
    SPAWN_INTERVAL: number;
  };
  DEBUG: {
    /** rebuilds and renders node/edge markers for the road graph on every road edit; O(citySize^2) per edit, so keep off outside debugging */
    SHOW_VEHICLE_GRAPH: boolean;
  };
}

const CONFIG = {
  ATTRIBUTES: {
    ROAD_ACCESS: {
      SEARCH_DISTANCE: 3,
    },
    POWER_ACCESS: {
      SEARCH_DISTANCE: 6,
      CAPACITY: 20,
    },
  },
  CITIZEN: {
    MIN_WORKING_AGE: 16,
    RETIREMENT_AGE: 65,
    MAX_JOB_SEARCH_DISTANCE: 4,
  },
  ZONE: {
    ABANDONMENT_CHANCE: 0.25,
    LEVEL_UP_CHANCE: 0.05,
    REDEVELOP_CHANCE: 0.25,
    ABANDONMENT_THRESHOLD: 10,
    MAX_RESIDENTS: 2,
    MAX_WORKERS: 2,
    RESIDENT_MOVE_IN_CHANCE: 0.5,
    CONSTRUCTION_TIME: 3,
  },
  CITY: {
    SIZE: 16,
  },
  VEHICLE: {
    SPEED: 0.0005,
    FADE_TIME: 1000,
    MAX_LIFETIME: 10000,
    MAX_VEHICLE_COUNT: 10,
    SPAWN_INTERVAL: 1000,
  },
  DEBUG: {
    SHOW_VEHICLE_GRAPH: false,
  },
} as const satisfies Config;

export default CONFIG;
