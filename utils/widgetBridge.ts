import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { requireNativeModule } from 'expo';

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
      NfitBackgroundSteps = requireNativeModule('NfitBackgroundSteps');
    } catch {
      try {
        NfitBackgroundSteps = require('expo-modules-core').NativeModulesProxy.NfitBackgroundSteps;
      } catch {
        NfitBackgroundSteps = null;
      }
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
    requestWidgetUpdate({
      widgetName: 'NfitWidget',
      renderWidget: () => import('../widget/widget-task-handler').then(m => m.widgetTaskHandler as any),
      widgetNotFound: () => {
        // Called if widget is not placed on the home screen
      }
    });
    return true;
  } catch (e) {
    console.error('[widgetBridge] refreshWidget failed:', e);
    return false;
  }
}

/**
 * Start the continuous background step tracking service
 */
export async function startBackgroundService(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.startService) {
      return await bg.startService();
    }
    return false;
  } catch (e) {
    console.error('[widgetBridge] startBackgroundService failed:', e);
    return false;
  }
}

/**
 * Stop the background step tracking service
 */
export async function stopBackgroundService(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.stopService) {
      return await bg.stopService();
    }
    return false;
  } catch (e) {
    console.error('[widgetBridge] stopBackgroundService failed:', e);
    return false;
  }
}

/**
 * Check if the background service is running
 */
export async function isBackgroundServiceRunning(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.isServiceRunning) {
      return await bg.isServiceRunning();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get today's total step count from the native service.
 * This is the primary API — the native service is the single source of truth.
 */
export async function getTotalDailySteps(): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.getTotalDailySteps) {
      return await bg.getTotalDailySteps();
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Seed the native service's daily step total.
 * Used on startup to ensure the native count includes steps
 * from SQLite history (e.g. after a service restart mid-day).
 */
export async function setTotalDailySteps(steps: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.setTotalDailySteps) {
      await bg.setTotalDailySteps(steps);
    }
  } catch {}
}

export async function getDailyStepsDate(): Promise<string> {
  if (Platform.OS !== 'android') return '';
  try {
    const bg = getBackgroundStepsModule();
    return (await bg?.getDailyStepsDate?.()) ?? '';
  } catch { return ''; }
}

export async function resetSensorBaseline(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const bg = getBackgroundStepsModule();
    await bg?.resetSensorBaseline?.();
  } catch {}
}

/**
 * Get accumulated steps from background tracking service.
 * @deprecated Use getTotalDailySteps() instead. This is kept for backward compat.
 */
export async function getAccumulatedSteps(): Promise<number> {
  return getTotalDailySteps();
}

/**
 * Reset accumulated background steps to 0.
 * @deprecated This resets the daily total — use with caution.
 */
export async function resetAccumulatedSteps(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.resetAccumulatedSteps) {
      await bg.resetAccumulatedSteps();
    }
  } catch {}
}

/**
 * Check if the app is subject to battery optimization restrictions.
 * Returns true if battery-optimized (i.e., restricted).
 */
export async function isBatteryOptimized(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.isBatteryOptimized) {
      return await bg.isBatteryOptimized();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Open the system dialog to exempt this app from battery optimization.
 * Returns true if the dialog was shown or the app is already exempt.
 */
export async function requestBatteryOptimizationExemption(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const bg = getBackgroundStepsModule();
    if (bg?.requestBatteryOptimizationExemption) {
      return await bg.requestBatteryOptimizationExemption();
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
