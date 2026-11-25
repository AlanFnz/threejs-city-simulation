import CONFIG from '../../config';
import { BUILDING_TYPE } from '../../city/building/constants';
import { DevelopmentState } from '../../city/building/attributes/development';
import { CITIZEN_STATE } from '../../city/citizen/constants';
import { blankSave, type SaveGameV1, type SavedTile } from './constants';

export const PUERTO_CLARO = 'puerto-claro';

// Each row runs west to east. The feeder branches around the residential
// blocks, while the freight road leaves the shopping street to the east.
const streets = [
  'P|||||||||......',
  '...|.....|......',
  '...|.rh.r|c.c...',
  '...|.========...',
  '...|r=h.t=cC=i.i',
  '...|.=...=..====',
  '...|F=..c=.S=.i.',
  '...|.========...',
  '...|.r.h.h..r...',
  '...||||||||||||.',
];

const buildings = {
  P: BUILDING_TYPE.POWER_PLANT,
  '|': BUILDING_TYPE.POWER_LINE,
  '=': BUILDING_TYPE.ROAD,
  F: BUILDING_TYPE.FIRE_STATION,
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

export function puertoClaroSave(size: number): SaveGameV1 {
  const save = blankSave();
  save.cityName = 'Puerto Claro';
  save.simulationDay = 84;
  save.money = 18500;
  save.milestones.completed.push('pop-10', 'pop-15', 'pop-25', 'commercial-5');
  save.milestones.unlockedToolIds.push(
    BUILDING_TYPE.FIRE_STATION,
    BUILDING_TYPE.POLICE_STATION
  );
  save.zoneLevelCaps.RESIDENTIAL = 4;

  const west = Math.floor((size - streets[0].length) / 2);
  const north = Math.floor((size - streets.length) / 2);
  let households = 0;
  let residents = 0;
  for (const [row, street] of streets.entries()) {
    for (const [col, symbol] of [...street].entries()) {
      if (symbol === '.') continue;
      const buildingType = buildings[symbol as keyof typeof buildings];
      const tile: SavedTile = { x: west + col, y: north + row, buildingType };
      if (
        buildingType === BUILDING_TYPE.RESIDENTIAL ||
        buildingType === BUILDING_TYPE.COMMERCIAL ||
        buildingType === BUILDING_TYPE.INDUSTRIAL
      ) {
        tile.style = 'ABC'[(col + 2 * row) % 3];
        tile.developmentState = DevelopmentState.DEVELOPED;
        tile.developmentLevel =
          symbol === 't' || symbol === 'C' ? 3 : symbol === 'h' ? 2 : 1;
        // The house just across from the shops is about to finish its foundations.
        if (row === 2 && col === 8) tile.constructionTicks = Math.floor(CONFIG.ZONE.UPGRADE_TIME / 2) - 6;
        tile.rotation = { x: 0, y: 0 };
        if (buildingType === BUILDING_TYPE.RESIDENTIAL) {
          const surname = surnames[households++ % surnames.length];
          tile.residents = Array.from(
            { length: 2 ** tile.developmentLevel },
            (_, i) => {
              const id = residents++;
              const age = [34, 37, 9, 67, 24, 45, 13, 20][i];
              return {
                id: 'puerto-' + id,
                firstName: firstNames[id % firstNames.length],
                surname,
                age,
                state:
                  age < CONFIG.CITIZEN.MIN_WORKING_AGE
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
  return save;
}
