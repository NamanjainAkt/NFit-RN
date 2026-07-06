import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Remove console.error in production - use silent fail
const logError = __DEV__ ? console.error : () => {};

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('achievements', {
      name: 'Achievements',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return true;
}

export async function sendGoalReachedNotification(steps: number): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Goal Achieved!',
        body: `Congratulations! You've reached ${steps.toLocaleString()} steps today!`,
        data: { type: 'goal_reached' },
      },
      trigger: null,
    });
  } catch {
    // Silently fail - notification is non-critical
  }
}

export async function sendStreakNotification(streak: number): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${streak} Day Streak!`,
        body: `Amazing! You've maintained your streak for ${streak} days. Keep it up!`,
        data: { type: 'streak' },
      },
      trigger: null,
    });
  } catch {
    // Silently fail - notification is non-critical
  }
}

export async function scheduleDailyReminder(hour: number = 20, minute: number = 0): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to move!',
        body: "Don't forget to get your steps in today.",
        data: { type: 'daily_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Silently fail
  }
}
