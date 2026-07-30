interface InfoPanelProps {
  html: string | null;
}

function InfoPanel({ html }: InfoPanelProps) {
  return (
    <div id="ui-info-overlay">
      <aside
        id="info-panel"
        className={`hud-panel${html ? ' visible' : ''}`}
        aria-label="Selected tile information"
        aria-hidden={!html}
      >
        <header className="panel-heading">
          <span className="panel-eyebrow">Selection</span>
          <h2>City inspector</h2>
        </header>
        <div
          id="info-overlay-details"
          dangerouslySetInnerHTML={{ __html: html ?? '' }}
        />
      </aside>
    </div>
  );
}

export { InfoPanel };
