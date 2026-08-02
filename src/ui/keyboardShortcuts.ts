import { TOOLBAR_BUTTONS } from './constants';

type KeyboardShortcutAction =
  | { type: 'selectTool'; toolId: string }
  | { type: 'togglePause' }
  | { type: 'cycleSimulationSpeed' };

const TOOL_ID_BY_KEY = Object.values(TOOLBAR_BUTTONS).reduce<
  Record<string, string>
>((toolIds, button) => {
  if (button.shortcut) toolIds[button.shortcut.toLowerCase()] = button.id;
  return toolIds;
}, {});

function getKeyboardShortcutAction(
  key: string,
  repeat: boolean = false
): KeyboardShortcutAction | null {
  const normalizedKey = key.toLowerCase();
  const toolId = TOOL_ID_BY_KEY[normalizedKey];
  if (toolId) return { type: 'selectTool', toolId };
  if (repeat) return null;
  if (key === ' ' || normalizedKey === 'spacebar') {
    return { type: 'togglePause' };
  }
  if (key === '.') return { type: 'cycleSimulationSpeed' };
  return null;
}

export { getKeyboardShortcutAction, KeyboardShortcutAction };
