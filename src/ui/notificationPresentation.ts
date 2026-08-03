import type { NotificationTone } from './store';

const NOTIFICATION_ICONS: Record<NotificationTone, string> = {
  success: '✓',
  warning: '!',
  milestone: '◆',
  event: '↯',
};

export { NOTIFICATION_ICONS };
