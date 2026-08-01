import { NotificationTone, UiNotification } from '../store';

interface NotificationCenterProps {
  notification: UiNotification | null;
}

const NOTIFICATION_ICONS: Record<NotificationTone, string> = {
  success: '✓',
  warning: '!',
  milestone: '◆',
  event: '↯',
};

function NotificationCenter({ notification }: NotificationCenterProps) {
  return (
    <div id="notification-center" aria-live="polite" aria-atomic="true">
      {notification && (
        <article
          key={notification.id}
          className={`hud-notification tone-${notification.tone}`}
          role={notification.tone === 'warning' ? 'alert' : 'status'}
        >
          <span className="notification-icon" aria-hidden="true">
            {NOTIFICATION_ICONS[notification.tone]}
          </span>
          <span className="notification-copy">
            <strong>{notification.title}</strong>
            <span>{notification.message}</span>
          </span>
          <span className="notification-timer" aria-hidden="true" />
        </article>
      )}
    </div>
  );
}

export { NotificationCenter };
