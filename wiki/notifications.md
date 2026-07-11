# Notifications

> `utils/notifications.ts` | Push notification management

## Functions

### `requestNotificationPermissions()`
Checks existing permission, requests if not granted. On Android: creates 3 channels.

### Notification Channels (Android)
| Channel | Importance | Purpose |
|---------|-----------|---------|
| `default` | MAX | Goal reached, streak |
| `reminders` | HIGH | Daily step reminders |
| `achievements` | DEFAULT | Achievement badges |

### `sendGoalReachedNotification(steps)`
Immediate notification: "Congratulations! You've reached {steps} steps today!"

### `sendStreakNotification(streak)`
Immediate notification: "{streak} Day Streak! Amazing!"

### `scheduleDailyReminder(hour, minute)`
Daily recurring notification: "Time to move!" Default 20:00.

### `cancelAllNotifications()`
Cancels all scheduled notifications.

## Error Handling
All functions silently fail in production. In dev, errors are logged via `console.error`.

## Dependencies
- `expo-notifications` — all notification APIs
