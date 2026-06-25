import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as Notifications from 'expo-notifications';

export async function checkActivityPermission(): Promise<boolean> {
  try {
    const result = await Pedometer.getPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

export async function requestActivityPermission(): Promise<boolean> {
  try {
    const result = await Pedometer.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const result = await Notifications.getPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const result = await Notifications.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}
