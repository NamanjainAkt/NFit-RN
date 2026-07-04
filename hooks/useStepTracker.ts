import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, AppState, AppStateStatus, Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import { Pedometer } from 'expo-sensors';
import { format } from 'date-fns';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { sendGoalReachedNotification, sendStreakNotification } from '../utils/notifications';
import { loadStepCounterState, saveStepCounterState, saveDailySteps, loadDailyStepsForDate, loadAllDailySteps } from '../utils/database';
import { calculateCalories, calculateDistance } from '../utils/calculations';

let backgroundStepsModule: any = null;
if (Platform.OS === 'android') {
  try {
    backgroundStepsModule = requireNativeModule('BackgroundStepsModule');
  } catch {}
}

export function useStepTracker() {
  const profile = useUserStore((state) => state.profile);
  const stepStreak = useUserStore((state) => state.stepStreak);
  const updateStepStreak = useUserStore((state) => state.updateStepStreak);
  const setStepHistory = useFitnessStore((state) => state.setStepHistory);
  const backgroundTrackingEnabled = useUserStore((state) => state.backgroundTrackingEnabled ?? true);

  const {
    todaySteps,
    setTodaySteps,
    setTodayFloors,
    setTodayActiveMinutes
  } = useFitnessStore();

  const [isSimulated, setIsSimulated] = useState(false);
  const [goalNotified, setGoalNotified] = useState(false);
  const [backgroundServiceActive, setBackgroundServiceActive] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const accumulatedRef = useRef(0);
  const sessionBaseRef = useRef(0);
  const maxDeltaRef = useRef(0);
  const lastEventTimeRef = useRef(0);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const shakeCooldownRef = useRef(0);
  const lastSensorStepsRef = useRef(-1);
  const stepRateWindowRef = useRef<{ increment: number; time: number }[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconcileTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const widgetModuleRef = useRef<any>(null);
  const currentDateRef = useRef(format(new Date(), 'yyyy-MM-dd'));
  const isResettingDayRef = useRef(false);
  // Ref to startWatching so checkDayChange can call it without a circular dep
  const startWatchingRef = useRef<() => Promise<void>>(async () => {});

  const syncWidget = useCallback(async (steps: number, goal: number) => {
    if (Platform.OS !== 'android') return;
    try {
      if (!widgetModuleRef.current) {
        widgetModuleRef.current = requireNativeModule('NfitWidgetModule');
      }
      await widgetModuleRef.current.updateWidget(steps, goal);
    } catch {}
  }, []);

  const persistSteps = useCallback(async (steps: number) => {
    await saveStepCounterState(steps);
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentProfile = profileRef.current;
    await saveDailySteps({
      date: today,
      steps,
      floors: Math.floor(steps / 200),
      activeMinutes: Math.floor(steps / 100),
      calories: currentProfile ? calculateCalories(steps, currentProfile.weight, currentProfile.useMetric) : 0,
      distance: currentProfile ? calculateDistance(steps, currentProfile.height, currentProfile.useMetric) : 0,
    });
  }, []);

  /** Read accumulated steps from the native foreground service (Android only) */
  const getNativeAccumulatedSteps = useCallback(async (): Promise<number> => {
    if (!backgroundStepsModule) return 0;
    try {
      return await backgroundStepsModule.getAccumulatedSteps();
    } catch {
      return 0;
    }
  }, []);

  /** Start the native foreground service */
  const startBackgroundService = useCallback(async () => {
    if (!backgroundStepsModule) return;
    try {
      const running = await backgroundStepsModule.isServiceRunning();
      if (!running) {
        await backgroundStepsModule.startService();
      }
      setBackgroundServiceActive(true);
    } catch {}
  }, []);

  /** Reconcile our JS-side accumulated count with the native service */
  const reconcileWithNative = useCallback(async () => {
    if (!backgroundStepsModule) return false;
    try {
      const nativeSteps = await backgroundStepsModule.getAccumulatedSteps();
      if (nativeSteps === 0) return false;

      const currentTotal = accumulatedRef.current +
        Math.max(0, (maxDeltaRef.current || 0) - (sessionBaseRef.current || 0));

      if (nativeSteps > currentTotal) {
        const delta = nativeSteps - currentTotal;
        accumulatedRef.current += delta;

        const currentProfile = profileRef.current;
        if (currentProfile) {
          setTodaySteps(accumulatedRef.current);
          setTodayFloors(Math.floor(accumulatedRef.current / 200));
          setTodayActiveMinutes(Math.floor(accumulatedRef.current / 100));
          syncWidget(accumulatedRef.current, currentProfile.dailyStepGoal || 10000);
        }
        return true;
      }
    } catch {}
    return false;
  }, [setTodaySteps, setTodayFloors, setTodayActiveMinutes, syncWidget]);

  const checkDayChange = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (currentDateRef.current === today) return;
    if (isResettingDayRef.current) return;
    isResettingDayRef.current = true;

    try {
      const lastDaySteps = accumulatedRef.current +
        Math.max(0, (maxDeltaRef.current || 0) - (sessionBaseRef.current || 0));
      const lastDate = currentDateRef.current;

      const currentProfile = profileRef.current;
      await saveDailySteps({
        date: lastDate,
        steps: lastDaySteps,
        floors: Math.floor(lastDaySteps / 200),
        activeMinutes: Math.floor(lastDaySteps / 100),
        calories: currentProfile ? calculateCalories(lastDaySteps, currentProfile.weight, currentProfile.useMetric) : 0,
        distance: currentProfile ? calculateDistance(lastDaySteps, currentProfile.height, currentProfile.useMetric) : 0,
      });

      accumulatedRef.current = 0;
      sessionBaseRef.current = 0;
      maxDeltaRef.current = 0;
      // Set to -1 so the first post-reset sensor event is treated as the new base
      // rather than causing a huge sensorIncrement that trips the spike filter.
      lastSensorStepsRef.current = -1;
      lastEventTimeRef.current = 0;
      currentDateRef.current = today;
      setGoalNotified(false);

      setTodaySteps(0);
      setTodayFloors(0);
      setTodayActiveMinutes(0);

      progressAnim.setValue(0);
      pulseAnim.setValue(1);

      await saveStepCounterState(0);
      await saveDailySteps({ date: today, steps: 0, floors: 0, activeMinutes: 0, calories: 0, distance: 0 });

      if (Platform.OS === 'android' && backgroundStepsModule) {
        try {
          await backgroundStepsModule.resetForNewDay();
        } catch {}
      }

      if (currentProfile) {
        syncWidget(0, currentProfile.dailyStepGoal || 10000);
      }

      // Restart the sensor watcher so sessionBaseRef re-anchors to today's hardware counter
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      await startWatchingRef.current();

      loadAllDailySteps().then(setStepHistory);
    } finally {
      isResettingDayRef.current = false;
    }
  }, [setTodaySteps, setTodayFloors, setTodayActiveMinutes, progressAnim, pulseAnim, syncWidget, setStepHistory]);

  const handleSteps = useCallback((delta: number) => {
    const currentProfile = profileRef.current;
    if (!currentProfile) return;

    const effectiveSteps = accumulatedRef.current + Math.max(0, delta - sessionBaseRef.current);

    if (delta > maxDeltaRef.current) {
      maxDeltaRef.current = delta;
    }

    setTodaySteps(effectiveSteps);
    setTodayFloors(Math.floor(effectiveSteps / 200));
    setTodayActiveMinutes(Math.floor(effectiveSteps / 100));

    const goal = currentProfile.dailyStepGoal || 10000;
    if (effectiveSteps >= goal) {
      updateStepStreak(format(new Date(), 'yyyy-MM-dd'));
    }

    syncWidget(effectiveSteps, goal);
  }, [setTodaySteps, setTodayFloors, setTodayActiveMinutes, updateStepStreak, syncWidget]);

  const enterCooldown = useCallback(() => {
    shakeCooldownRef.current = Date.now() + 5000;
  }, []);

  const handleWatchUpdate = useCallback((result: { steps: number }) => {
    if (Date.now() < shakeCooldownRef.current) return;
    const now = Date.now();
    if (now - lastEventTimeRef.current < 250) return;
    lastEventTimeRef.current = now;

    const delta = result.steps;

    if (sessionBaseRef.current === 0) {
      sessionBaseRef.current = delta;
    }

    // lastSensorStepsRef === -1 means this is the first event after a day reset.
    // Skip sensorIncrement calculation to avoid tripping the spike filter.
    const isFirstAfterReset = lastSensorStepsRef.current === -1;
    const sensorIncrement = isFirstAfterReset ? 0 : delta - lastSensorStepsRef.current;
    lastSensorStepsRef.current = delta;

    if (!isFirstAfterReset && sensorIncrement > 15) {
      enterCooldown();
      return;
    }

    if (delta < maxDeltaRef.current) {
      accumulatedRef.current += maxDeltaRef.current;
      maxDeltaRef.current = 0;
      sessionBaseRef.current = delta;
    }

    const effectiveSteps = accumulatedRef.current + Math.max(0, delta - sessionBaseRef.current);

    const rateBuf = stepRateWindowRef.current;
    rateBuf.push({ increment: sensorIncrement, time: now });
    while (rateBuf.length > 0 && now - rateBuf[0].time > 3000) rateBuf.shift();
    if (rateBuf.length >= 2) {
      const totalIncrements = rateBuf.reduce((sum, e) => sum + e.increment, 0);
      const windowSec = (now - rateBuf[0].time) / 1000;
      if (windowSec > 1 && totalIncrements / windowSec > 10) {
        enterCooldown();
        return;
      }
    }

    handleSteps(delta);
  }, [handleSteps, enterCooldown]);

  const startWatching = useCallback(async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        simulateSteps();
        return;
      }

      const result = await Pedometer.requestPermissionsAsync();
      if (!result.granted) {
        simulateSteps();
        return;
      }

      subscriptionRef.current = Pedometer.watchStepCount((data) => {
        handleWatchUpdate(data);
      });
    } catch {
      simulateSteps();
    }
  }, [handleWatchUpdate]);

  // Keep the ref in sync so checkDayChange always calls the latest version
  startWatchingRef.current = startWatching;

  useEffect(() => {
    const init = async () => {
      const state = await loadStepCounterState();
      const today = format(new Date(), 'yyyy-MM-dd');

      // Start the native background service so steps are tracked even when app is in background
      if (Platform.OS === 'android') {
        if (backgroundTrackingEnabled) {
          await startBackgroundService();
        } else {
          try {
            await backgroundStepsModule.stopService();
          } catch {}
        }

        // Read native accumulated steps — this catches steps tracked while app was killed
        const nativeSteps = await getNativeAccumulatedSteps();
        if (nativeSteps > 0) {
          const savedDate = state.lastUpdatedDate;
          if (savedDate === today) {
            accumulatedRef.current = Math.max(state.accumulatedSteps, nativeSteps);
          } else if (nativeSteps > 0) {
            // Native service has today's data but SQLite doesn't. Use native count.
            accumulatedRef.current = nativeSteps;
          }
        } else {
          // No native steps, fall back to SQLite persist
          if (state.lastUpdatedDate !== today) {
            accumulatedRef.current = 0;
            await saveStepCounterState(0);
          } else {
            accumulatedRef.current = state.accumulatedSteps;
          }
        }
      } else {
        // iOS or other — no background service, use SQLite solely
        if (state.lastUpdatedDate !== today) {
          accumulatedRef.current = 0;
          await saveStepCounterState(0);
        } else {
          accumulatedRef.current = state.accumulatedSteps;
        }
      }

      // Track the current date for live day-change detection
      currentDateRef.current = today;

      // Load today's saved data from SQLite to restore the UI state
      const saved = await loadDailyStepsForDate(today);
      if (saved && saved.steps > 0) {
        const finalSteps = Math.max(saved.steps, accumulatedRef.current);
        setTodaySteps(finalSteps);
        setTodayFloors(Math.floor(finalSteps / 200));
        setTodayActiveMinutes(Math.floor(finalSteps / 100));
        const goal = profileRef.current?.dailyStepGoal || 10000;
        syncWidget(finalSteps, goal);
      } else {
        setTodaySteps(accumulatedRef.current);
        const goal = profileRef.current?.dailyStepGoal || 10000;
        syncWidget(accumulatedRef.current, goal);
        setTodayFloors(Math.floor(accumulatedRef.current / 200));
        setTodayActiveMinutes(Math.floor(accumulatedRef.current / 100));
      }

      loadAllDailySteps().then((all) => {
        setStepHistory(all);
      });

      setIsSimulated(false);
      await startWatching();
    };

    init();

    // Periodic persist to SQLite every 30 seconds
    saveTimerRef.current = setInterval(async () => {
      await checkDayChange();

      const steps = accumulatedRef.current +
        Math.max(0, (maxDeltaRef.current || 0) - (sessionBaseRef.current || 0));
      await persistSteps(steps);

      // Also reconcile with native service every 30 seconds
      if (Platform.OS === 'android') {
        await reconcileWithNative();
      }
    }, 30000);

    // Fast reconciliation timer — catches up with native service and detects day changes
    reconcileTimerRef.current = setInterval(async () => {
      await checkDayChange();
      if (Platform.OS === 'android') {
        await reconcileWithNative();
      }
    }, 10000);

    // Handle app state changes
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;

      // App moved to background — persist steps
      if (prevState === 'active' && nextState.match(/inactive|background/)) {
        const steps = accumulatedRef.current +
          Math.max(0, (maxDeltaRef.current || 0) - (sessionBaseRef.current || 0));
        await persistSteps(steps);
      }

      // App returned to foreground — detect day change and reconcile with native service
      if (prevState?.match(/inactive|background/) && nextState === 'active') {
        await checkDayChange();
        if (Platform.OS === 'android') {
          await reconcileWithNative();
        }
      }

      appStateRef.current = nextState;
    });

    return () => {
      if (subscriptionRef.current) subscriptionRef.current.remove();
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      if (reconcileTimerRef.current) clearInterval(reconcileTimerRef.current);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (profile) {
      const goal = profile.dailyStepGoal || 10000;
      const progress = Math.min(todaySteps / goal, 1);

      Animated.spring(progressAnim, {
        toValue: progress,
        useNativeDriver: false,
        tension: 50,
        friction: 10
      }).start();

      if (progress >= 1 && !goalNotified) {
        setGoalNotified(true);
        sendGoalReachedNotification(todaySteps);

        if (stepStreak > 0 && stepStreak % 7 === 0) {
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

  useEffect(() => {
    const goal = profileRef.current?.dailyStepGoal || 10000;
    syncWidget(todaySteps, goal);
  }, [todaySteps, syncWidget]);

  const simulateSteps = () => {
    setIsSimulated(true);
    const simulatedSteps = Math.floor(Math.random() * 5000) + 1000;
    setTodaySteps(simulatedSteps);
    setTodayFloors(Math.floor(simulatedSteps / 200));
    setTodayActiveMinutes(Math.floor(simulatedSteps / 100));
  };

  return {
    todaySteps,
    isSimulated,
    progressAnim,
    pulseAnim,
    goal: profile?.dailyStepGoal || 10000,
    goalReached: todaySteps >= (profile?.dailyStepGoal || 10000),
    backgroundServiceActive,
  };
}
