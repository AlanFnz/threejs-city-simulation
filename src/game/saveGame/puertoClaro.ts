import CONFIG from '../../config';
import { BUILDING_TYPE } from '../../city/building/constants';
import { DevelopmentState } from '../../city/building/attributes/development';
import { CITIZEN_STATE } from '../../city/citizen/constants';
import { blankSave, type SaveGameV1, type SavedTile } from './constants';

export const PUERTO_CLARO = 'puerto-claro';

// Each row runs west to east. The feeder branches around the residential
// blocks, while the freight road leaves the shopping street to the east.
const streets = [
  'P|||||||||||||||||||||..',
  '...|.....|...........|..',
  '...|.rh.r|rhrr.......|..',
  '...|.================|..',
  '...|r=h.t=cC=ic.c..r=|..',
  '...|.=...=..=========P..',
  '...|F=.Hc=.S=.i.i.i.=...',
  '...|.================...',
  '...|.r.h.h..r..=.rEh=r..',
  '...||||||||||||=...r=r..',
  '..............|=r.ch=r..',
  '..............|======...',
  '..............|.rh.hr...',
  '..............||||||||..',
];

// The extensions share the original street coordinates so saved neighborhood views
// still frame the same block. Dots leave the land (and existing lots) alone.
const districts = [
  // West quarter
  {
    x: -7,
    y: 1,
    rows: [
      '.P|||||||P',
      '.|.rrh.rh',
      '.|.=======',
      '.|r=rhc.h=',
      '.|h=E..rr=',
      '.|r=======',
      '.|.c.h=h.=',
      '.|...r=.h=',
      '.||||r=.r=',
      '....|r=h.=ch..r',
      '....|.=========',
      '....|.r.h.hrrh=',
      '....P.........=',
    ],
  },
  // Freight district
  {
    x: 21,
    y: 1,
    rows: [
      '...P|||||||P|',
      '....|....ii.|',
      '....|..=====|',
      '....|.i=.ic=|',
      '....|..=...=|',
      '....|.i=.i.=|',
      '============|',
      '..i=.ic=..i=|',
      '..i=i.F=...=|',
      '...=...=..c=|',
      '============|',
      '...=hc.=.c..|',
      '...=...=....|',
    ],
  },
  // Southern center
  {
    x: 0,
    y: 14,
    rows: [
      '...r..h=.r..c..h...rC...=...=',
      '...==========================',
      '..h=c.C=.h.t=.C.r=t.c=.h=..h',
      '..r=H..=t...=..S.=.c.=.r=',
      '..t======================',
      '..h=.t.c....=..c.=t..Cc.=',
      '..c=..C...c.=.ht.=h...h.=',
      '...======================',
      '..|rh.c.t|r.hc|.c.t.|.h|...|',
      '.P||||||||||||P||||||||||P|||',
    ],
  },
];

const buildings = {
  P: BUILDING_TYPE.POWER_PLANT,
  '|': BUILDING_TYPE.POWER_LINE,
  '=': BUILDING_TYPE.ROAD,
  F: BUILDING_TYPE.FIRE_STATION,
  H: BUILDING_TYPE.HOSPITAL,
  E: BUILDING_TYPE.SCHOOL,
  S: BUILDING_TYPE.POLICE_STATION,
  r: BUILDING_TYPE.RESIDENTIAL,
  h: BUILDING_TYPE.RESIDENTIAL,
  t: BUILDING_TYPE.RESIDENTIAL,
  c: BUILDING_TYPE.COMMERCIAL,
  C: BUILDING_TYPE.COMMERCIAL,
  i: BUILDING_TYPE.INDUSTRIAL,
};

const firstNames = [
  'Luz',
  'Mateo',
  'Inés',
  'Bruno',
  'Alma',
  'Julián',
  'Vera',
  'Tomás',
];
const surnames = [
  'Costa',
  'Ríos',
  'Sosa',
  'Acosta',
  'Vega',
  'Luna',
  'Paz',
  'Ruiz',
  'Ramos',
  'Soler',
];

function streetOrigin(size: number) {
  return {
    west: Math.floor((size - streets[0].length) / 2),
    north: Math.floor((size - streets.length) / 2),
  };
}

// The four front gardens face the shops across the northern shopping street.
export function puertoClaroGardenBlock(size: number) {
  const { west, north } = streetOrigin(size);
  return [
    { x: west + 10, y: north + 2 },
    { x: west + 13, y: north + 3 },
  ];
}

export function puertoClaroSave(size: number): SaveGameV1 {
  const save = blankSave();
  save.cityName = 'Puerto Claro';
  save.simulationDay = 84;
  save.money = 18500;
  save.milestones.completed.push(
    'pop-10',
    'pop-15',
    'pop-25',
    'pop-40',
    'pop-60',
    'commercial-5'
  );
  save.milestones.unlockedToolIds.push(
    BUILDING_TYPE.FIRE_STATION,
    BUILDING_TYPE.POLICE_STATION,
    BUILDING_TYPE.HOSPITAL,
    BUILDING_TYPE.SCHOOL
  );
  save.zoneLevelCaps.RESIDENTIAL = 4;

  const { west, north } = streetOrigin(size);
  let households = 0;
  let residents = 0;
  const expanded = districts.every(
    ({ x, y, rows }) =>
      west + x >= 0 &&
      north + y >= 0 &&
      west + x + Math.max(...rows.map((row) => row.length)) <= size &&
      north + y + rows.length <= size
  );
  if (expanded) {
    save.milestones.completed.push('industrial-5');
    save.zoneLevelCaps.COMMERCIAL = 4;
  }
  const neighborhoods = [
    { x: 0, y: 0, rows: streets },
    ...(expanded ? districts : []),
  ];
  for (const district of neighborhoods) {
    for (const [j, street] of district.rows.entries()) {
      for (const [i, symbol] of [...street].entries()) {
        const col = district.x + i,
          row = district.y + j;
        if (symbol === '.') continue;
        const buildingType = buildings[symbol as keyof typeof buildings];
        const tile: SavedTile = { x: west + col, y: north + row, buildingType };
        if (
          buildingType === BUILDING_TYPE.RESIDENTIAL ||
          buildingType === BUILDING_TYPE.COMMERCIAL ||
          buildingType === BUILDING_TYPE.INDUSTRIAL
        ) {
          tile.style = 'ABC'[(((col + 2 * row) % 3) + 3) % 3];
          tile.developmentState = DevelopmentState.DEVELOPED;
          tile.developmentLevel =
            symbol === 't' || symbol === 'C' ? 3 : symbol === 'h' ? 2 : 1;
          // The house just across from the shops is about to finish its foundations.
          if (row === 2 && col === 8)
            tile.constructionTicks =
              Math.floor(CONFIG.ZONE.UPGRADE_TIME / 2) - 6;
          tile.rotation = { x: 0, y: 0 };
          if (buildingType === BUILDING_TYPE.RESIDENTIAL) {
            const surname = surnames[households++ % surnames.length];
            tile.residents = Array.from(
              { length: 2 ** tile.developmentLevel },
              (_, i) => {
                const id = residents++;
                const age = [34, 37, 9, 67, 24, 45, 13, 20][i];
                // The first adult in each garden house starts with a local shift.
                const employer =
                  row === 2 && i === 0 ? [10, 11, 11, 13][col - 10] : undefined;
                return {
                  ...(employer === undefined
                    ? {}
                    : { workplace: { x: west + employer, y: north + 4 } }),
                  id: 'puerto-' + id,
                  firstName: firstNames[id % firstNames.length],
                  surname,
                  age,
                  state:
                    employer !== undefined
                      ? CITIZEN_STATE.EMPLOYED
                      : age < CONFIG.CITIZEN.MIN_WORKING_AGE
                        ? CITIZEN_STATE.SCHOOL
                        : age >= CONFIG.CITIZEN.RETIREMENT_AGE
                          ? CITIZEN_STATE.RETIRED
                          : CITIZEN_STATE.UNEMPLOYED,
                };
              }
            );
          }
        }
        save.tiles.push(tile);
      }
    }
  }
  if (expanded) {
    staffNeighborhoods(save.tiles);
  }
  return save;
}

// Give the expanded city's households a local commute from the first morning.
function staffNeighborhoods(tiles: SavedTile[]): void {
  const workplaces = tiles
    .filter(
      (tile) =>
        tile.buildingType === BUILDING_TYPE.COMMERCIAL ||
        tile.buildingType === BUILDING_TYPE.INDUSTRIAL
    )
    .map(({ x, y, developmentLevel }) => ({
      x,
      y,
      openings: CONFIG.ZONE.MAX_WORKERS ** (developmentLevel ?? 1),
    }));
  for (const home of tiles) {
    for (const resident of home.residents ?? []) {
      const workplace = resident.workplace;
      if (!workplace) continue;
      const job = workplaces.find(
        ({ x, y }) => x === workplace.x && y === workplace.y
      );
      if (job) job.openings--;
    }
  }
  for (const home of tiles) {
    if (!home.residents || home.residents.some((r) => r.workplace)) continue;
    const worker = home.residents.find(
      (r) => r.state === CITIZEN_STATE.UNEMPLOYED
    );
    if (!worker) continue;
    let nearest: (typeof workplaces)[number] | undefined;
    let distance = CONFIG.CITIZEN.MAX_JOB_SEARCH_DISTANCE + 1;
    for (const job of workplaces) {
      const blocks = Math.abs(job.x - home.x) + Math.abs(job.y - home.y);
      if (job.openings > 0 && blocks < distance) {
        nearest = job;
        distance = blocks;
      }
    }
    if (!nearest) continue;
    nearest.openings--;
    worker.state = CITIZEN_STATE.EMPLOYED;
    worker.workplace = { x: nearest.x, y: nearest.y };
  }
}
