import { describe, expect, it } from 'vitest';
import { TOOLBAR_BUTTONS } from './constants';
import { getKeyboardShortcutAction } from './keyboardShortcuts';

describe('getKeyboardShortcutAction', () => {
  it('maps build and selection keys to tools', () => {
    expect(getKeyboardShortcutAction('Escape')).toEqual({
      type: 'selectTool',
      toolId: TOOLBAR_BUTTONS.SELECT.id,
    });
    expect(getKeyboardShortcutAction('1')).toEqual({
      type: 'selectTool',
      toolId: TOOLBAR_BUTTONS.RESIDENTIAL.id,
    });
    expect(getKeyboardShortcutAction('r')).toEqual({
      type: 'selectTool',
      toolId: TOOLBAR_BUTTONS.ROAD.id,
    });
    expect(getKeyboardShortcutAction('B')).toEqual({
      type: 'selectTool',
      toolId: TOOLBAR_BUTTONS.BULLDOZE.id,
    });
  });

  it('maps simulation controls and ignores repeated toggles', () => {
    expect(getKeyboardShortcutAction(' ')).toEqual({
      type: 'togglePause',
    });
    expect(getKeyboardShortcutAction('.')).toEqual({
      type: 'cycleSimulationSpeed',
    });
    expect(getKeyboardShortcutAction('h')).toEqual({ type: 'toggleHud' });
    expect(getKeyboardShortcutAction(' ', true)).toBeNull();
    expect(getKeyboardShortcutAction('.', true)).toBeNull();
    expect(getKeyboardShortcutAction('h', true)).toBeNull();
  });

  it('ignores unrelated keys', () => {
    expect(getKeyboardShortcutAction('x')).toBeNull();
  });
});
