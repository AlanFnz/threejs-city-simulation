import { NOTIFICATION_ICONS } from '../notificationPresentation';
import { UiNotification } from '../store';

interface NotificationCenterProps {
  notification: UiNotification | null;
  onDismiss: () => void;
}

function NotificationCenter({ notification, onDismiss }: NotificationCenterProps) {
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
          <button
            className="notification-dismiss"
            type="button"
            aria-label={`Dismiss ${notification.title} notification`}
            onClick={onDismiss}
          >
            ×
          </button>
          <span className="notification-timer" aria-hidden="true" />
        </article>
      )}
    </div>
  );
}

export { NotificationCenter };
