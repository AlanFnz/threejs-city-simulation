import { ICON_KEYS, IconKey } from '../assetManager/icons';

type BaseButton = {
  id: string;
  icon: IconKey;
  uiText: string;
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

const TOOLBAR_BUTTONS: ToolbarButtons = {
  SELECT: {
    id: 'SELECT',
    icon: ICON_KEYS.SELECT_COLOR,
    uiText: 'SELECT',
  },

  RESIDENTIAL: {
    id: 'RESIDENTIAL',
    icon: ICON_KEYS.HOUSE_COLOR,
    uiText: 'RESIDENTIAL',
  },
  COMMERCIAL: {
    id: 'COMMERCIAL',
    icon: ICON_KEYS.STORE_COLOR,
    uiText: 'COMMERCIAL',
  },
  INDUSTRIAL: {
    id: 'INDUSTRIAL',
    icon: ICON_KEYS.FACTORY_COLOR,
    uiText: 'INDUSTRIAL',
  },
  ROAD: {
    id: 'ROAD',
    icon: ICON_KEYS.ROAD_COLOR,
    uiText: 'ROAD',
  },
  POWER_PLANT: {
    id: 'POWER_PLANT',
    icon: ICON_KEYS.POWER_COLOR,
    uiText: 'POWER PLANT',
  },
  BULLDOZE: {
    id: 'BULLDOZE',
    icon: ICON_KEYS.BULLDOZER_COLOR,
    uiText: 'BULLDOZE',
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

const INFO_UI_TEXT = 'INFO';

export {
  BaseButton,
  ToggleButton,
  ToolbarButtons,
  TOOLBAR_BUTTONS,
  INFO_UI_TEXT,
};
