import { describe, expect, it } from 'vitest';
import { BUILDING_TYPE } from '../city/building/constants';
import { TOOLBAR_BUTTONS } from '../ui/constants';
import { createToolRejectionNotification } from './toolFeedback';

describe('createToolRejectionNotification', () => {
  it('explains occupied placement tiles', () => {
    expect(
      createToolRejectionNotification('occupiedTile', BUILDING_TYPE.ROAD)
    ).toEqual({
      tone: 'warning',
      title: 'Tile already occupied',
      message: 'Bulldoze the existing structure before placing road.',
    });
  });

  it('includes the configured placement cost when funds are insufficient', () => {
    expect(
      createToolRejectionNotification(
        'insufficientFunds',
        BUILDING_TYPE.POWER_PLANT
      )
    ).toEqual({
      tone: 'warning',
      title: 'Not enough city funds',
      message: 'Power plant costs $500 per tile.',
    });
  });

  it('explains empty bulldoze targets', () => {
    expect(
      createToolRejectionNotification(
        'emptyTile',
        TOOLBAR_BUTTONS.BULLDOZE.id
      )
    ).toEqual({
      tone: 'warning',
      title: 'Nothing to bulldoze',
      message: 'Choose a tile containing a building or infrastructure.',
    });
  });
});
