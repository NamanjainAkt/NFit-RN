import { Platform } from 'react-native';
import { useFitnessStore } from '../store/fitnessStore';
import { useUserStore } from '../store/userStore';
import { calculateCalories, calculateDistance } from './calculations';

// Native module references (loaded lazily)
let NfitWidget: any = null;
let NfitBackgroundSteps: any = null;

function getWidgetModule() {
  if (!NfitWidget) {
    try {
      NfitWidget = require('expo-modules-core').NativeModulesProxy.NfitWidget;
    } catch {
      NfitWidget = null;
    }
  }
  return NfitWidget;
}

function getBackgroundStepsModule() {
  if (!NfitBackgroundSteps) {
    try {
      NfitBackgroundSteps = require('expo-modules-core').NativeModulesProxy.NfitBackgroundSteps;
    } catch {
      NfitBackgroundSteps = null;
    }
  }
  return NfitBackgroundSteps;
}

/**
 * Refresh the home screen widget with current data
 */
export async function refreshWidget(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const profile = useUserStore.getState().profile;
    if (!profile) return false;

    const { todaySteps, todayFloors, todayActiveMinutes } = useFitnessStore.getState();
    const stepStreak = useUserStore.getState().stepStreak;

    const calories = calculateCalories(todaySteps, profile.weight, profile.useMetric);
    const distance = calculateDistance(todaySteps, profile.height, profile.useMetric);
    const distanceUnit = profile.useMetric ? 'km' : 'mi';

    const widget = getWidgetModule();
    if (widget?.updateWidgetData) {
      await widget.updateWidgetData({
        steps: todaySteps,
        goal: profile.dailyStepGoal || 10000,
        calories,
        distance,
        streak: stepStreak,
        floors: todayFloors,
        activeMinutes: todayActiveMinutes,
        distanceUnit,
      });
      return true;
    }

    // Fallback: just trigger refresh
    if (widget?.updateWidget) {
      await widget.updateWidget();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get current widget data from native storage
 */
export async function getWidgetData(): Promise<Record<string, any> | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const widget = getWidgetModule();
    if (widget?.getWidgetData) {
      return await widget.getWidgetData();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Start background step tracking service
 */
export async function startBackgroundService(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const bg = getBackgroundStepsModule();
    if (bg?.startService) {
      await bg.startService();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Stop background step tracking service
 */
export async function stopBackgroundService(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const bg = getBackgroundStepsModule();
    if (bg?.stopService) {
      await bg.stopService();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Force widget to update by writing latest data
 */
export async function pushDataToWidget(): Promise<void> {
  await refreshWidget();
}
