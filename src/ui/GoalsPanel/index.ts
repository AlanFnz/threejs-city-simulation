function createGoalsPanel() {
  const goalsOverlay = document.getElementById('ui-goals-overlay') as HTMLElement;

  if (!goalsOverlay) {
    console.error('GoalsPanel element not found!');
    return;
  }

  goalsOverlay.id = 'goals-panel';

  const headerContainer = document.createElement('div');
  headerContainer.className = 'info-heading';

  const goalsTitle = document.createElement('span');
  goalsTitle.textContent = 'GOALS';
  headerContainer.appendChild(goalsTitle);

  goalsOverlay.appendChild(headerContainer);

  const detailsContainer = document.createElement('div');
  detailsContainer.id = 'goals-overlay-details';

  goalsOverlay.appendChild(detailsContainer);
}

export { createGoalsPanel };
