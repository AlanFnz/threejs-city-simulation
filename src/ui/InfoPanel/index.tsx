interface InfoPanelProps {
  html: string | null;
}

function InfoPanel({ html }: InfoPanelProps) {
  return (
    <div id="ui-info-overlay">
      <div id="info-panel" className={html ? 'visible' : undefined}>
        <div className="info-heading">
          <span>INFO</span>
        </div>
        <div
          id="info-overlay-details"
          dangerouslySetInnerHTML={{ __html: html ?? '' }}
        />
      </div>
    </div>
  );
}

export { InfoPanel };
