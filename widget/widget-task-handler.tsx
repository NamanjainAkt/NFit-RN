import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NfitWidget } from './NfitWidget';
import { zustandStorage } from '../utils/storage';
import { NativeModules } from 'react-native';

/**
 * Widget task handler. Reads the daily step total directly from
 * the native StepTrackerService (SharedPreferences) — the single
 * source of truth. Falls back to zustand storage if native module
 * is unavailable. No double-counting.
 */
export async function widgetTaskHandler({
  widgetAction,
  widgetInfo,
  renderWidget,
}: WidgetTaskHandlerProps) {
  let steps = 0;
  let goal = 10000;

  try {
    // Primary: read total daily steps from native service
    try {
      const bgModule = NativeModules.NfitBackgroundSteps;
      if (bgModule && typeof bgModule.getTotalDailySteps === 'function') {
        const nativeSteps = await bgModule.getTotalDailySteps();
        if (typeof nativeSteps === 'number' && nativeSteps > 0) {
          steps = nativeSteps;
        }
      }
    } catch {}

    // Fallback: read from zustand storage if native unavailable
    if (steps === 0) {
      try {
        const fitnessDataStr = await zustandStorage.getItem('fitness-storage');
        if (fitnessDataStr) {
          const fitnessData = JSON.parse(fitnessDataStr);
          steps = fitnessData.state?.todaySteps || 0;
        }
      } catch {}
    }

    // Read goal from user storage
    try {
      const userDataStr = await zustandStorage.getItem('user-storage');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        goal = userData.state?.profile?.dailyStepGoal || 10000;
      }
    } catch {}
  } catch (error) {
    console.error('[widgetTaskHandler] error:', error);
  }

  renderWidget(
    <NfitWidget steps={steps} goal={goal} />
  );
}
