import SELECT from './select.png';
import SELECT_COLOR from './select-color.png';
import BULLDOZER from './bulldozer.png';
import BULLDOZER_COLOR from './bulldozer-color.png';
import HOUSE from './house.png';
import HOUSE_COLOR from './house-color.png';
import OFFICE from './office.png';
import FACTORY from './factory.png';
import FACTORY_COLOR from './factory-color.png';
import JOB from './job.png';
import CALENDAR from './calendar.png';
import PERSON from './person.png';
import PAUSE from './pause.png';
import PAUSE_COLOR from './pause-color.png';
import PLAY from './play.png';
import PLAY_COLOR from './play-color.png';
import ROAD from './road.png';
import ROAD_COLOR from './road-color.png';
import STORE_COLOR from './store-color.png';
import POWER_COLOR from './power-color.png';
import POWER_LINE_COLOR from './power-line-color.png';

export const ICON_KEYS = {
  SELECT: 'SELECT',
  SELECT_COLOR: 'SELECT_COLOR',
  BULLDOZER: 'BULLDOZER',
  BULLDOZER_COLOR: 'BULLDOZER_COLOR',
  HOUSE: 'HOUSE',
  HOUSE_COLOR: 'HOUSE_COLOR',
  OFFICE: 'OFFICE',
  FACTORY: 'FACTORY',
  FACTORY_COLOR: 'FACTORY_COLOR',
  JOB: 'JOB',
  CALENDAR: 'CALENDAR',
  PERSON: 'PERSON',
  ROAD: 'ROAD',
  ROAD_COLOR: 'ROAD_COLOR',
  PAUSE: 'PAUSE',
  PAUSE_COLOR: 'PAUSE_COLOR',
  PLAY: 'PLAY',
  PLAY_COLOR: 'PLAY_COLOR',
  STORE_COLOR: 'STORE_COLOR',
  POWER_COLOR: 'POWER_COLOR',
  POWER_LINE_COLOR: 'POWER_LINE_COLOR',
} as const;

type IconKey = (typeof ICON_KEYS)[keyof typeof ICON_KEYS];

const icons: Record<IconKey, string> = {
  SELECT,
  SELECT_COLOR,
  BULLDOZER,
  BULLDOZER_COLOR,
  HOUSE,
  HOUSE_COLOR,
  OFFICE,
  FACTORY,
  FACTORY_COLOR,
  JOB,
  CALENDAR,
  PERSON,
  PAUSE,
  PAUSE_COLOR,
  PLAY,
  PLAY_COLOR,
  ROAD,
  ROAD_COLOR,
  STORE_COLOR,
  POWER_COLOR,
  POWER_LINE_COLOR,
};

function isValidIconKey(key: string): key is IconKey {
  return Object.keys(icons).includes(key);
}

const getIcon = (icon: IconKey) => icons[icon];

export { IconKey, getIcon, isValidIconKey };
