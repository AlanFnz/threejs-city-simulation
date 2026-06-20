import { describe, it, expect } from 'vitest';
import { createTools } from '.';
import { SelectTool } from './selectTool';
import { BulldozeTool } from './bulldozeTool';
import { BuildingTool } from './buildingTool';
import { TOOLBAR_BUTTONS } from '../../ui/constants';
import { BUILDING_TYPE } from '../../city/building/constants';

describe('createTools', () => {
  it('creates one tool per toolbar id, keyed by that id', () => {
    const tools = createTools();

    expect(tools[TOOLBAR_BUTTONS.SELECT.id]).toBeInstanceOf(SelectTool);
    expect(tools[TOOLBAR_BUTTONS.BULLDOZE.id]).toBeInstanceOf(BulldozeTool);
    expect(tools[BUILDING_TYPE.RESIDENTIAL]).toBeInstanceOf(BuildingTool);
    expect(tools[BUILDING_TYPE.COMMERCIAL]).toBeInstanceOf(BuildingTool);
    expect(tools[BUILDING_TYPE.INDUSTRIAL]).toBeInstanceOf(BuildingTool);
    expect(tools[BUILDING_TYPE.ROAD]).toBeInstanceOf(BuildingTool);
  });

  it('does not include a tool for TOGGLE_PAUSE (handled outside the tool system)', () => {
    const tools = createTools();
    expect(tools[TOOLBAR_BUTTONS.TOGGLE_PAUSE.id]).toBeUndefined();
  });
});
