import { createInfoPanel } from './InfoPanel';
import { createToolBar } from './ToolBar';
import { createTopBar } from './TopBar';
import { createGoalsPanel } from './GoalsPanel';

export function createUi(isToolUnlocked: (toolId: string) => boolean) {
  createTopBar();
  createToolBar(isToolUnlocked);
  createInfoPanel();
  createGoalsPanel();
}

