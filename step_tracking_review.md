# Step Tracking Code Review Bundle

This file contains all the core files related to step tracking, permissions, and background services for the Nfit project.

## File: hooks/useStepTracker.ts

`ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { format } from 'date-fns';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { loadDailyStepsForDate } from '../utils/database';
import { sendGoalReachedNotification, sendStreakNotification } from '../utils/notifications';
import {
  refreshWidget,
  startBackgroundService,
  getTotalDailySteps,
  setTotalDailySteps,
  isBackgroundServiceRunning,
  requestBatteryOptimizationExemption,
  isBatteryOptimized,
} from '../utils/widgetBridge';

/**
 * Step tracking hook — polls the native StepTrackerService for the
 * daily total every 2 seconds. The native service uses the hardware
 * TYPE_STEP_COUNTER sensor which runs continuously in the background
 * and is inherently shake-resistant.
 *
 * Architecture: Native service = single source of truth.
 * JS only reads, never counts independently.
 */
export function useStepTracker() {
  const profile = useUserStore((state) => state.profile);
  const stepStreak = useUserStore((state) => state.stepStreak);
  const updateStepStreak = useUserStore((state) => state.updateStepStreak);

  const {
    todaySteps,
    setTodaySteps,
    setTodayFloors,
    setTodayActiveMinutes
  } = useFitnessStore();

  const [isSimulated, setIsSimulated] = useState(false);
  const [goalNotified, setGoalNotified] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const stepsRef = useRef(todaySteps);
  stepsRef.current = todaySteps;

  const notifyWidget = useCallback(async (_steps: number) => {
    try {
      await refreshWidget();
    } catch (e) {
      console.error('[useStepTracker] notifyWidget failed:', e);
    }
  }, []);

  const simulateSteps = () => {
    setIsSimulated(true);
    const simulatedSteps = Math.floor(Math.random() * 5000) + 1000;
    setTodaySteps(simulatedSteps);
    setTodayFloors(Math.floor(simulatedSteps / 200));
    setTodayActiveMinutes(Math.floor(simulatedSteps / 100));
  };

  const updateStepsFromNative = useCallback((nativeTotal: number) => {
    if (nativeTotal <= 0) return;
    setTodaySteps(nativeTotal);
    setTodayFloors(Math.floor(nativeTotal / 200));
    setTodayActiveMinutes(Math.floor(nativeTotal / 100));
  }, [setTodaySteps, setTodayFloors, setTodayActiveMinutes]);

  // ── Main setup: start service, seed baseline, begin polling ───────
  useEffect(() => {
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const setup = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');

        // 1. Load baseline from SQLite (most recent persisted total)
        let baselineSteps = 0;
        try {
          const saved = await loadDailyStepsForDate(today);
          if (saved && saved.steps > 0) {
            baselineSteps = saved.steps;
          } else {
            const { stepHistory } = useFitnessStore.getState();
            const todayEntry = stepHistory.find((d) => d.date === today);
            if (todayEntry && todayEntry.steps > 0) {
              baselineSteps = todayEntry.steps;
            }
          }
        } catch {}

        // 2. Check pedometer availability (needed for ACTIVITY_RECOGNITION permission)
        const available = await Pedometer.isAvailableAsync();
        if (!available) {
          if (mounted) simulateSteps();
          return;
        }

        // 3. Request permission (ACTIVITY_RECOGNITION on Android)
        const permResult = await Pedometer.requestPermissionsAsync();
        if (!permResult.granted) {
          if (mounted) simulateSteps();
          return;
        }

        // 4. Start the native background service
        try {
          await startBackgroundService();
        } catch (e) {
          console.warn('[useStepTracker] startBackgroundService failed:', e);
        }

        // 5. Request battery optimization exemption (shows system dialog once)
        try {
          const isOptimized = await isBatteryOptimized();
          if (isOptimized) {
            await requestBatteryOptimizationExemption();
          }
        } catch {}

        // 6. Read native total, seed with baseline if native is behind
        let nativeTotal = await getTotalDailySteps();
        if (nativeTotal < baselineSteps) {
          await setTotalDailySteps(baselineSteps);
          nativeTotal = baselineSteps;
        }

        // 7. Set initial state
        if (mounted) {
          updateStepsFromNative(nativeTotal > 0 ? nativeTotal : baselineSteps);
          notifyWidget(nativeTotal);
        }

        // 8. Poll native service every 2 seconds for real-time updates
        let lastKnownSteps = nativeTotal;
        pollInterval = setInterval(async () => {
          if (!mounted) return;
          try {
            const currentTotal = await getTotalDailySteps();
            if (currentTotal > 0 && currentTotal !== lastKnownSteps) {
              lastKnownSteps = currentTotal;
              updateStepsFromNative(currentTotal);
            }
          } catch {}
        }, 2000);

      } catch {
        if (mounted) simulateSteps();
      }
    };

    setup();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // ── App state: on resume, immediately poll + ensure service is alive ─
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Immediately read native total on app resume
        try {
          const currentTotal = await getTotalDailySteps();
          if (currentTotal > 0) {
            updateStepsFromNative(currentTotal);
            notifyWidget(currentTotal);
          }
        } catch {}

        // Ensure the service survived backgrounding
        try {
          const running = await isBackgroundServiceRunning();
          if (!running) {
            await startBackgroundService();
          }
        } catch {}
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [updateStepsFromNative, notifyWidget]);

  // ── Widget sync on profile change ─────────────────────────────────
  useEffect(() => {
    if (profile) {
      notifyWidget(todaySteps);
    }
  }, [profile]);

  // ── Goal detection, confetti, streak, notifications ───────────────
  useEffect(() => {
    if (profile) {
      const goal = profile.dailyStepGoal || 10000;
      const progress = Math.min(todaySteps / goal, 1);

      Animated.timing(progressAnim, {
        toValue: progress,
        useNativeDriver: true,
        duration: 300,
      }).start();

      if (progress >= 1 && !goalNotified) {
        setGoalNotified(true);
        sendGoalReachedNotification(todaySteps);
        updateStepStreak(format(new Date(), 'yyyy-MM-dd'), true);

        if ((stepStreak + 1) % 7 === 0) {
          sendStreakNotification(stepStreak);
        }

        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          ]), { iterations: 3 }
        ).start();
      }
    }
  }, [todaySteps, profile, stepStreak, goalNotified]);

  // Reset goal notification flag when steps drop below goal (day rollover)
  useEffect(() => {
    if (todaySteps < (profile?.dailyStepGoal || 10000)) {
      setGoalNotified(false);
    }
  }, [todaySteps, profile]);

  return {
    todaySteps,
    isSimulated,
    progressAnim,
    pulseAnim,
    goal: profile?.dailyStepGoal || 10000,
    goalReached: todaySteps >= (profile?.dailyStepGoal || 10000),
  };
}

`

## File: store/fitnessStore.ts

`ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { format } from 'date-fns';
import { zustandStorage } from '../utils/storage';
import { calculateCalories, calculateDistance } from '../utils/calculations';
import { useUserStore } from './userStore';
import { saveDailySteps } from '../utils/database';

export interface DailySteps {
  date: string;
  steps: number;
  floors: number;
  activeMinutes: number;
  calories: number;
  distance: number;
}

interface FitnessState {
  todaySteps: number;
  todayFloors: number;
  todayActiveMinutes: number;
  stepHistory: DailySteps[];
  currentStreak: number;
  setTodaySteps: (steps: number) => void;
  syncTodayWithHistory: () => void;
  setTodayFloors: (floors: number) => void;
  setTodayActiveMinutes: (minutes: number) => void;
  recordDay: (data: Omit<DailySteps, 'date'>) => void;
  getWeekHistory: () => DailySteps[];
  getMonthHistory: () => DailySteps[];
  getYearHistory: () => DailySteps[];
}

// Debounced widget refresh to avoid excessive calls
let widgetRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedWidgetRefresh() {
  if (widgetRefreshTimeout) clearTimeout(widgetRefreshTimeout);
  widgetRefreshTimeout = setTimeout(() => {
    try {
      // Dynamic import to avoid circular dependency
      const { refreshWidget } = require('../utils/widgetBridge');
      refreshWidget();
    } catch {
      // Widget module not available - silently ignore
    }
  }, 2000);
}

// Debounced SQLite persistence for daily_steps table
let dbSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedDbSave() {
  if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
  dbSaveTimeout = setTimeout(() => {
    try {
      const { todaySteps, todayFloors, todayActiveMinutes } = useFitnessStore.getState();
      const profile = useUserStore.getState().profile;
      const calories = profile ? calculateCalories(todaySteps, profile.weight, profile.useMetric) : 0;
      const distance = profile ? calculateDistance(todaySteps, profile.height, profile.useMetric) : 0;
      const today = format(new Date(), 'yyyy-MM-dd');
      saveDailySteps({
        date: today,
        steps: todaySteps,
        floors: todayFloors,
        activeMinutes: todayActiveMinutes,
        calories,
        distance,
      }).catch(() => {});
    } catch {
      // DB not ready yet
    }
  }, 3000);
}

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set, get) => ({
      todaySteps: 0,
      todayFloors: 0,
      todayActiveMinutes: 0,
      stepHistory: [],
      currentStreak: 0,
      setTodaySteps: (steps) => {
        set({ todaySteps: steps });
        get().syncTodayWithHistory();
        debouncedWidgetRefresh();
        debouncedDbSave();
      },
      syncTodayWithHistory: () => {
        const { todaySteps, todayFloors, todayActiveMinutes, recordDay } = get();
        const userState = useUserStore.getState();
        const profile = userState.profile;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const baseCalories = profile ? calculateCalories(todaySteps, profile.weight, profile.useMetric) : 0;
        const workoutCalories = userState.workouts
          .filter((w: any) => w.date === todayStr)
          .reduce((sum: number, w: any) => sum + (Number(w.calories) || 0), 0);
          
        const calories = baseCalories + workoutCalories;
        const distance = profile ? calculateDistance(todaySteps, profile.height, profile.useMetric) : 0;
        recordDay({ steps: todaySteps, floors: todayFloors, activeMinutes: todayActiveMinutes, calories, distance });
      },
      setTodayFloors: (floors) => {
        set({ todayFloors: floors });
        get().syncTodayWithHistory();
      },
      setTodayActiveMinutes: (minutes) => {
        set({ todayActiveMinutes: minutes });
        get().syncTodayWithHistory();
      },
      recordDay: (data) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { stepHistory } = get();
        const existingIndex = stepHistory.findIndex((d) => d.date === today);
        if (existingIndex >= 0) {
          const updated = [...stepHistory];
          updated[existingIndex] = { ...data, date: today };
          set({ stepHistory: updated });
        } else {
          set({ stepHistory: [...stepHistory, { ...data, date: today }] });
        }
      },
      getWeekHistory: () => {
        const { stepHistory } = get();
        const today = new Date();
        const weekData: DailySteps[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const existing = stepHistory.find((d) => d.date === dateStr);
          weekData.push(existing || { date: dateStr, steps: 0, floors: 0, activeMinutes: 0, calories: 0, distance: 0 });
        }
        return weekData;
      },
      getMonthHistory: () => {
        const { stepHistory } = get();
        const today = new Date();
        const monthData: DailySteps[] = [];
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        for (let i = 0; i < daysInMonth; i++) {
          const date = new Date(today.getFullYear(), today.getMonth(), i + 1);
          const dateStr = format(date, 'yyyy-MM-dd');
          const existing = stepHistory.find((d) => d.date === dateStr);
          monthData.push(existing || { date: dateStr, steps: 0, floors: 0, activeMinutes: 0, calories: 0, distance: 0 });
        }
        return monthData;
      },
      getYearHistory: () => {
        const { stepHistory } = get();
        const today = new Date();
        const profile = useUserStore.getState().profile;
        const yearData: DailySteps[] = [];
        for (let month = 0; month <= today.getMonth(); month++) {
          const daysInMonth = new Date(today.getFullYear(), month + 1, 0).getDate();
          let monthSteps = 0;
          let monthFloors = 0;
          let monthActiveMinutes = 0;
          for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(today.getFullYear(), month, day);
            const dateStr = format(date, 'yyyy-MM-dd');
            const existing = stepHistory.find((d) => d.date === dateStr);
            if (existing) {
              monthSteps += existing.steps;
              monthFloors += existing.floors;
              monthActiveMinutes += existing.activeMinutes;
            }
          }
          yearData.push({
            date: `${today.getFullYear()}-${String(month + 1).padStart(2, '0')}-01`,
            steps: monthSteps,
            floors: monthFloors,
            activeMinutes: monthActiveMinutes,
            calories: profile ? calculateCalories(monthSteps, profile.weight, profile.useMetric) : 0,
            distance: profile ? calculateDistance(monthSteps, profile.height, profile.useMetric) : 0,
          });
        }
        return yearData;
      },
    }),
    {
      name: 'fitness-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

`

## File: utils/widgetBridge.ts

`ts
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

`

## File: package.json

`json
{
  "name": "nfit",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  },
  "dependencies": {
    "@expo/vector-icons": "^15.1.1",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-native-community/cli": "^20.1.2",
    "babel-preset-expo": "~54.0.10",
    "date-fns": "^4.1.0",
    "expo": "~54.0.0",
    "expo-constants": "~18.0.13",
    "expo-file-system": "~19.0.23",
    "expo-font": "~14.0.12",
    "expo-linking": "~8.0.12",
    "expo-notifications": "~0.32.17",
    "expo-router": "~6.0.24",
    "expo-sensors": "~15.0.8",
    "expo-sharing": "~14.0.8",
    "expo-sqlite": "~16.0.10",
    "expo-status-bar": "~3.0.9",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.5",
    "react-native-android-widget": "^0.21.0",
    "react-native-safe-area-context": "~5.6.2",
    "react-native-screens": "~4.16.0",
    "react-native-web": "^0.21.0",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@babel/core": "^7.26.10",
    "@testing-library/react-native": "^13.3.3",
    "@types/jest": "^29.5.14",
    "@types/react": "~19.1.10",
    "jest": "^29.7.0",
    "jest-expo": "~54.0.17",
    "react-test-renderer": "19.1.0",
    "typescript": "~5.9.2"
  },
  "private": true
}

`

## File: app.json

`json
{
  "expo": {
    "name": "Nfit",
    "slug": "Nfit",
    "version": "1.2.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "scheme": "nfit",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#8AB4F8"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.nfit.app",
      "infoPlist": {
        "NSMotionUsageDescription": "Nfit needs access to your motion sensors to count your steps and track your activity."
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#8AB4F8",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "package": "com.nfit.app",
      "permissions": [
        "android.permission.ACTIVITY_RECOGNITION",
        "android.permission.BODY_SENSORS",
        "android.permission.HIGH_SAMPLING_RATE_SENSORS",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_HEALTH",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.WAKE_LOCK",
        "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "plugins": [
      "expo-router",
      "expo-notifications",
      [
        "expo-sensors",
        {
          "isBackgroundEnabled": true
        }
      ],
      "expo-sqlite",
      [
        "react-native-android-widget",
        {
          "widgets": [
            {
              "name": "NfitWidget",
              "label": "NFit Widget",
              "minWidth": "110dp",
              "minHeight": "110dp",
              "description": "Keep track of your steps from the home screen",
              "updatePeriodMillis": 86400000
            }
          ]
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "d330709f-3ffd-45dc-a471-a71a8db172e6"
      }
    },
    "owner": "namanjainakt"
  }
}

`

## File: android/app/src/main/AndroidManifest.xml

`xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION"/>
  <uses-permission android:name="android.permission.BODY_SENSORS"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_HEALTH"/>
  <uses-permission android:name="android.permission.HIGH_SAMPLING_RATE_SENSORS"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
  <uses-permission android:name="android.permission.VIBRATE"/>
  <uses-permission android:name="android.permission.WAKE_LOCK"/>
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
  <queries>
    <intent>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="https"/>
    </intent>
  </queries>
  <application android:name=".MainApplication" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:allowBackup="true" android:theme="@style/AppTheme" android:supportsRtl="true" android:enableOnBackInvokedCallback="false">
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="false"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
    <service android:name="com.reactnativeandroidwidget.RNWidgetCollectionService" android:permission="android.permission.BIND_REMOTEVIEWS"/>
    <activity android:name=".MainActivity" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode" android:launchMode="singleTask" android:windowSoftInputMode="adjustResize" android:theme="@style/Theme.App.SplashScreen" android:exported="true" android:screenOrientation="portrait">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
      <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="nfit"/>
      </intent-filter>
    </activity>
    <receiver android:name=".widget.NfitWidget" android:exported="false" android:label="NFit Widget">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="com.nfit.app.WIDGET_CLICK"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widgetprovider_nfitwidget"/>
    </receiver>
  </application>
</manifest>
`

## File: modules/nfit-background-steps/android/src/main/AndroidManifest.xml

`xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_HEALTH" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
  <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
  <uses-permission android:name="android.permission.WAKE_LOCK" />
  <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

  <application>
    <service
      android:name="expo.modules.nfitbackgroundsteps.StepTrackerService"
      android:enabled="true"
      android:exported="false"
      android:foregroundServiceType="health" />
    <receiver
      android:name="expo.modules.nfitbackgroundsteps.BootReceiver"
      android:enabled="true"
      android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
      </intent-filter>
    </receiver>
  </application>
</manifest>

`

## File: modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/BackgroundStepsModule.kt

`kotlin
package expo.modules.nfitbackgroundsteps

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.modules.ModuleDefinitionData

class BackgroundStepsModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  private val prefs: SharedPreferences?
    get() = context?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  override fun definition(): ModuleDefinitionData = ModuleDefinition {
    Name("NfitBackgroundSteps")

    // ── Service lifecycle ───────────────────────────────────────────

    AsyncFunction("startService") {
      val ctx = context ?: return@AsyncFunction false
      try {
        StepTrackerService.startService(ctx)
        true
      } catch (e: Exception) {
        Log.e(TAG, "startService failed", e)
        false
      }
    }

    AsyncFunction("stopService") {
      val ctx = context ?: return@AsyncFunction false
      try {
        StepTrackerService.stopService(ctx)
        true
      } catch (e: Exception) {
        Log.e(TAG, "stopService failed", e)
        false
      }
    }

    AsyncFunction("isServiceRunning") {
      val ctx = context ?: return@AsyncFunction false
      val manager = ctx.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        ?: return@AsyncFunction false
      @Suppress("DEPRECATION")
      for (service in manager.getRunningServices(Int.MAX_VALUE)) {
        if (StepTrackerService::class.java.name == service.service.className) {
          return@AsyncFunction true
        }
      }
      false
    }

    // ── Daily step total (single source of truth) ───────────────────

    /**
     * Returns today's total step count as tracked by the native service.
     * This is the primary API for the JS layer to read steps.
     */
    AsyncFunction("getTotalDailySteps") {
      prefs?.getInt(KEY_DAILY_TOTAL_STEPS, 0) ?: 0
    }

    /**
     * Seeds the daily step total. Used by the JS layer on startup to
     * ensure the native count includes steps from SQLite history
     * (e.g. after a service restart mid-day).
     */
    AsyncFunction("setTotalDailySteps") { steps: Int ->
      prefs?.edit()
        ?.putInt(KEY_DAILY_TOTAL_STEPS, steps)
        ?.putInt(KEY_ACCUMULATED_STEPS, steps) // backward compat
        ?.apply()
    }

    // ── Backward-compatible aliases ─────────────────────────────────

    AsyncFunction("getAccumulatedSteps") {
      // Now returns the same daily total for backward compatibility
      prefs?.getInt(KEY_DAILY_TOTAL_STEPS, 0) ?: 0
    }

    AsyncFunction("resetAccumulatedSteps") {
      prefs?.edit()
        ?.putInt(KEY_DAILY_TOTAL_STEPS, 0)
        ?.putInt(KEY_ACCUMULATED_STEPS, 0)
        ?.apply()
    }

    // ── Battery optimization ────────────────────────────────────────

    /**
     * Returns true if the app is already exempt from battery optimization.
     */
    AsyncFunction("isBatteryOptimized") {
      val ctx = context ?: return@AsyncFunction true
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        return@AsyncFunction !pm.isIgnoringBatteryOptimizations(ctx.packageName)
      } else {
        return@AsyncFunction false
      }
    }

    /**
     * Opens the system dialog asking the user to exempt this app
     * from battery optimization, ensuring the step tracking service
     * survives aggressive battery savers (Xiaomi, Samsung, Oppo, etc.).
     */
    AsyncFunction("requestBatteryOptimizationExemption") {
      val ctx = context ?: return@AsyncFunction false
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
          if (pm.isIgnoringBatteryOptimizations(ctx.packageName)) {
            return@AsyncFunction true // Already exempt
          }
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${ctx.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          ctx.startActivity(intent)
          true
        } else {
          true // Pre-M doesn't have battery optimization
        }
      } catch (e: Exception) {
        Log.e(TAG, "Battery optimization request failed", e)
        false
      }
    }
  }

  companion object {
    private const val TAG = "NfitBackgroundSteps"
    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_DAILY_TOTAL_STEPS = "daily_total_steps"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps"
  }
}

`

## File: modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/StepTrackerService.kt

`kotlin
package expo.modules.nfitbackgroundsteps

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Foreground service that continuously counts steps using the hardware
 * TYPE_STEP_COUNTER sensor. This is the single source of truth for step
 * counting — the JS layer polls the daily total from SharedPreferences
 * instead of counting independently.
 *
 * TYPE_STEP_COUNTER is hardware-backed on virtually all Android devices
 * (API 19+). It uses the low-power co-processor and has built-in shake/
 * vibration rejection, so no custom burst filter is needed.
 */
class StepTrackerService : Service(), SensorEventListener {

  private lateinit var sensorManager: SensorManager
  private var stepCounterSensor: Sensor? = null
  private lateinit var prefs: SharedPreferences
  private var wakeLock: PowerManager.WakeLock? = null

  private var lastWidgetUpdateSteps = 0

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "StepTrackerService onCreate")

    prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    createNotificationChannel()
    startForegroundServiceWithNotification()
    acquireWakeLock()

    // Enqueue WorkManager watchdog to restart this service if it ever dies
    StepTrackerWorker.enqueueWatchdog(applicationContext)

    if (stepCounterSensor != null) {
      val registered = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
        sensorManager.registerListener(
          this,
          stepCounterSensor,
          SensorManager.SENSOR_DELAY_NORMAL,
          0 // deliver immediately
        )
      } else {
        sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL)
      }
      Log.d(TAG, "TYPE_STEP_COUNTER registered: $registered")
    } else {
      Log.w(TAG, "TYPE_STEP_COUNTER not available. Falling back to TYPE_STEP_DETECTOR.")
      val stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
      if (stepDetectorSensor != null) {
        sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL)
        Log.d(TAG, "TYPE_STEP_DETECTOR registered")
      } else {
        Log.e(TAG, "No step tracking sensors available on this device")
      }
    }

    lastWidgetUpdateSteps = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d(TAG, "StepTrackerService onStartCommand")
    startForegroundServiceWithNotification()
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null || event.values.isEmpty()) return

    val isCounter = event.sensor.type == Sensor.TYPE_STEP_COUNTER
    val isDetector = event.sensor.type == Sensor.TYPE_STEP_DETECTOR

    if (!isCounter && !isDetector) return

    // Day rollover check
    val today = getTodayDateString()
    val storedDate = prefs.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
    if (storedDate != today) {
      prefs.edit()
        .putInt(KEY_DAILY_TOTAL_STEPS, 0)
        .putString(KEY_DAILY_STEPS_DATE, today)
        .putFloat(KEY_LAST_SENSOR_TOTAL, if (isCounter) event.values[0] else -1f)
        .putInt(KEY_ACCUMULATED_STEPS, 0)
        .apply()
      lastWidgetUpdateSteps = 0
      updateNotification(0)
      triggerWidgetUpdateBroadcast()
      Log.d(TAG, "Day rollover → reset for $today")
      return
    }

    if (isDetector) {
      // Step detector fires once per step. Just increment by 1.
      val currentDailyTotal = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
      val newDailyTotal = currentDailyTotal + 1
      
      prefs.edit()
        .putInt(KEY_DAILY_TOTAL_STEPS, newDailyTotal)
        .putInt(KEY_ACCUMULATED_STEPS, newDailyTotal)
        .apply()
        
      Log.d(TAG, "Detector Steps +1 → daily total: $newDailyTotal")
      updateNotification(newDailyTotal)
      if (Math.abs(newDailyTotal - lastWidgetUpdateSteps) >= 10) {
        lastWidgetUpdateSteps = newDailyTotal
        triggerWidgetUpdateBroadcast()
      }
      return
    }

    // --- TYPE_STEP_COUNTER LOGIC ---
    val currentSensorTotal = event.values[0]
    if (currentSensorTotal <= 0) return

    val savedLastSensor = prefs.getFloat(KEY_LAST_SENSOR_TOTAL, -1f)
    if (savedLastSensor < 0f) {
      prefs.edit()
        .putFloat(KEY_LAST_SENSOR_TOTAL, currentSensorTotal)
        .putString(KEY_DAILY_STEPS_DATE, today)
        .apply()
      return
    }

    if (currentSensorTotal >= savedLastSensor) {
      val delta = (currentSensorTotal - savedLastSensor).toInt()
      if (delta > 0) {
        val currentDailyTotal = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
        val newDailyTotal = currentDailyTotal + delta
        prefs.edit()
          .putInt(KEY_DAILY_TOTAL_STEPS, newDailyTotal)
          .putFloat(KEY_LAST_SENSOR_TOTAL, currentSensorTotal)
          .putInt(KEY_ACCUMULATED_STEPS, newDailyTotal)
          .apply()
        Log.d(TAG, "Steps +$delta → daily total: $newDailyTotal")
        updateNotification(newDailyTotal)
        if (Math.abs(newDailyTotal - lastWidgetUpdateSteps) >= 10) {
          lastWidgetUpdateSteps = newDailyTotal
          triggerWidgetUpdateBroadcast()
        }
      }
    } else {
      val delta = currentSensorTotal.toInt()
      val currentDailyTotal = prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0)
      val newDailyTotal = currentDailyTotal + delta
      prefs.edit()
        .putInt(KEY_DAILY_TOTAL_STEPS, newDailyTotal)
        .putFloat(KEY_LAST_SENSOR_TOTAL, currentSensorTotal)
        .putInt(KEY_ACCUMULATED_STEPS, newDailyTotal)
        .apply()
      Log.d(TAG, "Sensor reboot detected. Steps +$delta → daily total: $newDailyTotal")
      updateNotification(newDailyTotal)
      triggerWidgetUpdateBroadcast()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onDestroy() {
    super.onDestroy()
    Log.d(TAG, "StepTrackerService onDestroy")
    releaseWakeLock()
    try {
      sensorManager.unregisterListener(this)
    } catch (e: Exception) {
      Log.e(TAG, "Error unregistering sensor listener", e)
    }
  }

  /**
   * Called when the user swipes the app away from Recents.
   * Schedule a restart so step tracking continues uninterrupted.
   */
  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    Log.d(TAG, "onTaskRemoved — scheduling restart in 3s")
    try {
      val restartIntent = Intent(applicationContext, StepTrackerService::class.java).apply {
        setPackage(packageName)
      }
      val pendingIntent = PendingIntent.getService(
        this, 1, restartIntent,
        PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
      )
      val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarmManager.set(
        AlarmManager.ELAPSED_REALTIME_WAKEUP,
        SystemClock.elapsedRealtime() + 3000,
        pendingIntent
      )
    } catch (e: Exception) {
      Log.e(TAG, "Failed to schedule restart on task removed", e)
    }
  }

  // ── WakeLock ──────────────────────────────────────────────────────────

  private fun acquireWakeLock() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "nfit:step_tracking"
      ).apply {
        acquire()
      }
      Log.d(TAG, "Partial WakeLock acquired")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to acquire WakeLock", e)
    }
  }

  private fun releaseWakeLock() {
    try {
      wakeLock?.let {
        if (it.isHeld) {
          it.release()
          Log.d(TAG, "WakeLock released")
        }
      }
      wakeLock = null
    } catch (e: Exception) {
      Log.e(TAG, "Error releasing WakeLock", e)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private fun getTodayDateString(): String {
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
  }

  // ── Notification ──────────────────────────────────────────────────────

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Nfit Step Tracking",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Continuous step tracking in the background"
        setShowBadge(false)
      }
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(dailySteps: Int): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this, 0, launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Nfit Step Tracker")
      .setContentText("$dailySteps steps today")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  private fun startForegroundServiceWithNotification() {
    val notification = buildNotification(prefs.getInt(KEY_DAILY_TOTAL_STEPS, 0))
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun updateNotification(dailySteps: Int) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(dailySteps))
  }

  // ── Widget ────────────────────────────────────────────────────────────

  private fun triggerWidgetUpdateBroadcast() {
    try {
      val intent = Intent("com.reactnativeandroidwidget.UPDATE")
      intent.setPackage(packageName)
      sendBroadcast(intent)

      val appWidgetManager = AppWidgetManager.getInstance(applicationContext)
      val componentName = ComponentName(packageName, "com.nfit.app.widget.NfitWidget")
      val widgetIds = appWidgetManager.getAppWidgetIds(componentName)
      if (widgetIds != null && widgetIds.isNotEmpty()) {
        val updateIntent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
          component = componentName
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
        }
        sendBroadcast(updateIntent)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error sending widget update broadcast", e)
    }
  }

  // ── Constants & Static ────────────────────────────────────────────────

  companion object {
    private const val TAG = "StepTrackerService"
    const val PREFS_NAME = "nfit_background_steps"
    const val KEY_DAILY_TOTAL_STEPS = "daily_total_steps"
    const val KEY_DAILY_STEPS_DATE = "daily_steps_date"
    const val KEY_LAST_SENSOR_TOTAL = "last_sensor_total"
    const val KEY_ACCUMULATED_STEPS = "accumulated_steps" // backward compat
    private const val CHANNEL_ID = "nfit_background_step_channel"
    private const val NOTIFICATION_ID = 1001

    fun startService(context: Context) {
      val intent = Intent(context, StepTrackerService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stopService(context: Context) {
      val intent = Intent(context, StepTrackerService::class.java)
      context.stopService(intent)
    }
  }
}

`

## File: modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/StepTrackerWorker.kt

`kotlin
package expo.modules.nfitbackgroundsteps

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * WorkManager watchdog that runs every 15 minutes to ensure
 * StepTrackerService is alive. If the service was killed by an
 * OEM battery saver or a system resource reclaim, this restarts it.
 *
 * Calling startService when it's already running is a safe no-op
 * (triggers onStartCommand with START_STICKY).
 */
class StepTrackerWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    try {
      StepTrackerService.startService(applicationContext)
      Log.d(TAG, "Watchdog: ensured StepTrackerService is running")
      Result.success()
    } catch (e: Exception) {
      Log.e(TAG, "Watchdog: failed to (re)start service", e)
      Result.retry()
    }
  }

  companion object {
    private const val TAG = "StepTrackerWatchdog"
    private const val WORK_NAME = "nfit_step_service_watchdog"

    /**
     * Enqueue a periodic 15-minute watchdog. Uses KEEP policy so
     * multiple enqueue calls are idempotent.
     */
    fun enqueueWatchdog(context: Context) {
      val request = PeriodicWorkRequest.Builder(
        StepTrackerWorker::class.java,
        15, TimeUnit.MINUTES
      ).build()

      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request
      )
    }
  }
}

`

