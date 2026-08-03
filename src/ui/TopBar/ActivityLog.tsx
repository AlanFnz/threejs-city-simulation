import { NOTIFICATION_ICONS } from '../notificationPresentation';
import type { UiNotification } from '../store';

interface ActivityLogProps {
  activity: UiNotification[];
}

function ActivityLog({ activity }: ActivityLogProps) {
  return (
    <section className="city-activity" aria-label="Recent city activity">
      <header>
        <span>Recent activity</span>
        <small>{activity.length === 0 ? 'No events' : `${activity.length} latest`}</small>
      </header>
      {activity.length === 0 ? (
        <p className="city-activity-empty">
          Milestones, city events, and management actions will appear here.
        </p>
      ) : (
        <ol className="city-activity-list">
          {activity.map((entry) => (
            <li className={`tone-${entry.tone}`} key={entry.id}>
              <span className="city-activity-icon" aria-hidden="true">
                {NOTIFICATION_ICONS[entry.tone]}
              </span>
              <span>
                <strong>{entry.title}</strong>
                <small>{entry.message}</small>
              </span>
              <time>Day {entry.day.toLocaleString()}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export { ActivityLog };
