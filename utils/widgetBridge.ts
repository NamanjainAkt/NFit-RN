import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import { useFitnessStore } from '../store/fitnessStore';
import { useUserStore } from '../store/userStore';
import { calculateCalories, calculateDistance } from './calculations';

// Native module references (loaded lazily)
let NfitWidget: any = null;
let NfitBackgroundSteps: any = null;

function getWidgetModule() {
  if (!NfitWidget) {
    try {
      NfitWidget = requireNativeModule('NfitWidget');
    } catch (e) {
      console.warn('[widgetBridge] requireNativeModule failed:', e);
      try {
        NfitWidget = require('expo-modules-core').NativeModulesProxy.NfitWidget;
      } catch (e2) {
        console.warn('[widgetBridge] NativeModulesProxy fallback failed:', e2);
        NfitWidget = null;
      }
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
      const data = {
        steps: todaySteps,
        goal: profile.dailyStepGoal || 10000,
        calories,
        distance,
        streak: stepStreak,
        floors: todayFloors,
        activeMinutes: todayActiveMinutes,
        distanceUnit,
      };
      console.log('[widgetBridge] calling updateWidgetData with:', data);
      await widget.updateWidgetData(data);
      return true;
    } else {
      console.warn('[widgetBridge] widget module or updateWidgetData not available');
    }

    // Fallback: just trigger refresh
    if (widget?.updateWidget) {
      console.log('[widgetBridge] calling updateWidget fallback');
      await widget.updateWidget();
      return true;
    }

    return false;
  } catch (e) {
    console.error('[widgetBridge] refreshWidget failed:', e);
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
 * Get accumulated steps from WorkManager background tracking.
 * Returns the total steps recorded while app was closed.
 */
export async function getAccumulatedSteps(): Promise<number> {
  if (Platform.OS !== 'android') return 0;

  try {
    const bg = getBackgroundStepsModule();
    if (bg?.getAccumulatedSteps) {
      return await bg.getAccumulatedSteps();
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Force widget to update by writing latest data
 */
export async function pushDataToWidget(): Promise<void> {
  await refreshWidget();
}
