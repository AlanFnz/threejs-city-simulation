import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { GoalsPanel } from './GoalsPanel';
import { InfoPanel } from './InfoPanel';
import { ToolBar } from './ToolBar';
import { TopBar } from './TopBar';

let uiRoot: Root | null = null;

interface UiProps {
  isToolUnlocked: (toolId: string) => boolean;
}

function Ui({ isToolUnlocked }: UiProps) {
  return (
    <>
      <TopBar />
      <ToolBar isUnlocked={isToolUnlocked} />
      <GoalsPanel />
      <InfoPanel />
      <div id="event-toast" role="status" aria-live="polite" />
    </>
  );
}

export function createUi(
  isToolUnlocked: (toolId: string) => boolean
): void {
  const container = document.getElementById('ui-root');
  if (!container) {
    console.error('UI root element not found!');
    return;
  }

  uiRoot ??= createRoot(container);

  // Game still reads the legacy element IDs immediately after createUi().
  // Flush this compatibility render synchronously until UI state moves behind
  // the React store in the next migration step.
  flushSync(() => {
    uiRoot?.render(<Ui isToolUnlocked={isToolUnlocked} />);
  });
}
