import { ICON_KEYS, IconKey } from '../assetManager/icons';

type BaseButton = {
  id: string;
  icon: IconKey;
  uiText: string;
  shortcut?: string;
};

type ToggleButton = BaseButton & {
  iconPlay: IconKey;
  iconPause: IconKey;
  uiTextPlay: string;
  uiTextPause: string;
};

type ToolbarButtons = {
  [key: string]: BaseButton | ToggleButton;
};

type ToolCategory = {
  id: string;
  icon: IconKey;
  label: string;
  toolIds: string[];
};

const TOOLBAR_BUTTONS: ToolbarButtons = {
  SELECT: {
    id: 'SELECT',
    icon: ICON_KEYS.SELECT_COLOR,
    uiText: 'SELECT',
    shortcut: 'Escape',
  },

  RESIDENTIAL: {
    id: 'RESIDENTIAL',
    icon: ICON_KEYS.HOUSE_COLOR,
    uiText: 'RESIDENTIAL',
    shortcut: '1',
  },
  COMMERCIAL: {
    id: 'COMMERCIAL',
    icon: ICON_KEYS.STORE_COLOR,
    uiText: 'COMMERCIAL',
    shortcut: '2',
  },
  INDUSTRIAL: {
    id: 'INDUSTRIAL',
    icon: ICON_KEYS.FACTORY_COLOR,
    uiText: 'INDUSTRIAL',
    shortcut: '3',
  },
  ROAD: {
    id: 'ROAD',
    icon: ICON_KEYS.ROAD_COLOR,
    uiText: 'ROAD',
    shortcut: 'R',
  },
  POWER_PLANT: {
    id: 'POWER_PLANT',
    icon: ICON_KEYS.POWER_COLOR,
    uiText: 'POWER PLANT',
    shortcut: '4',
  },
  POWER_LINE: {
    id: 'POWER_LINE',
    icon: ICON_KEYS.POWER_LINE_COLOR,
    uiText: 'POWER LINE',
    shortcut: '5',
  },
  FIRE_STATION: {
    id: 'FIRE_STATION',
    icon: ICON_KEYS.FIRE_STATION_COLOR,
    uiText: 'FIRE STATION',
    shortcut: '6',
  },
  POLICE_STATION: {
    id: 'POLICE_STATION',
    icon: ICON_KEYS.POLICE_STATION_COLOR,
    uiText: 'POLICE STATION',
    shortcut: '7',
  },
  HOSPITAL: {
    id: 'HOSPITAL',
    icon: ICON_KEYS.HOSPITAL_COLOR,
    uiText: 'HOSPITAL',
    shortcut: '8',
  },
  SCHOOL: {
    id: 'SCHOOL',
    icon: ICON_KEYS.SCHOOL_COLOR,
    uiText: 'SCHOOL',
    shortcut: '9',
  },
  BULLDOZE: {
    id: 'BULLDOZE',
    icon: ICON_KEYS.BULLDOZER_COLOR,
    uiText: 'BULLDOZE',
    shortcut: 'B',
  },

  TOGGLE_PAUSE: {
    id: 'TOGGLE_PAUSE',
    icon: ICON_KEYS.PAUSE_COLOR, // fallback icon if needed
    iconPlay: ICON_KEYS.PLAY_COLOR,
    iconPause: ICON_KEYS.PAUSE_COLOR,
    uiText: 'PAUSE', // fallback text if needed
    uiTextPlay: 'PLAY',
    uiTextPause: 'PAUSE',
  } as ToggleButton,
};

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'ZONES',
    icon: ICON_KEYS.HOUSE_COLOR,
    label: 'Zones',
    toolIds: ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL'],
  },
  {
    id: 'POWER',
    icon: ICON_KEYS.POWER_COLOR,
    label: 'Power',
    toolIds: ['POWER_PLANT', 'POWER_LINE'],
  },
  {
    id: 'SERVICES',
    icon: ICON_KEYS.HOSPITAL_COLOR,
    label: 'Services',
    toolIds: ['FIRE_STATION', 'POLICE_STATION', 'HOSPITAL', 'SCHOOL'],
  },
];

const INFO_UI_TEXT = 'INFO';

export {
  BaseButton,
  ToolCategory,
  ToggleButton,
  ToolbarButtons,
  TOOLBAR_BUTTONS,
  TOOL_CATEGORIES,
  INFO_UI_TEXT,
};
