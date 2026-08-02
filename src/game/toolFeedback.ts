import CONFIG from '../config';
import { TOOLBAR_BUTTONS } from '../ui/constants';
import type { NewUiNotification } from '../ui/store';
import type { ToolRejectionReason } from './tools';

const BUILD_COSTS = CONFIG.ECONOMY.BUILD_COST as Record<string, number>;

function getToolLabel(toolId: string): string {
  return (
    Object.values(TOOLBAR_BUTTONS).find((button) => button.id === toolId)
      ?.uiText ?? 'This tool'
  ).toLowerCase();
}

export function createToolRejectionNotification(
  reason: ToolRejectionReason,
  toolId: string
): NewUiNotification {
  const toolLabel = getToolLabel(toolId);

  if (reason === 'occupiedTile') {
    return {
      tone: 'warning',
      title: 'Tile already occupied',
      message: `Bulldoze the existing structure before placing ${toolLabel}.`,
    };
  }

  if (reason === 'insufficientFunds') {
    const cost = BUILD_COSTS[toolId] ?? 0;
    const sentenceToolLabel =
      toolLabel.charAt(0).toUpperCase() + toolLabel.slice(1);
    return {
      tone: 'warning',
      title: 'Not enough city funds',
      message: `${sentenceToolLabel} costs $${cost.toLocaleString()} per tile.`,
    };
  }

  return {
    tone: 'warning',
    title: 'Nothing to bulldoze',
    message: 'Choose a tile containing a building or infrastructure.',
  };
}
