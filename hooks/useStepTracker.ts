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
  getDailyStepsDate,
  resetSensorBaseline,
} from '../utils/widgetBridge';
import { requestNotificationPermissions } from '../utils/notifications';

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

  const [trackingUnavailable, setTrackingUnavailable] = useState(false);
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

  const handleTrackingUnavailable = () => {
    setTrackingUnavailable(true);
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
          if (mounted) handleTrackingUnavailable();
          return;
        }

        // 3. Request permission (ACTIVITY_RECOGNITION on Android)
        const permResult = await Pedometer.requestPermissionsAsync();
        if (!permResult.granted) {
          if (mounted) handleTrackingUnavailable();
          return;
        }

        // 3.5 Request notification permission + create channels
        await requestNotificationPermissions();

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

        // 6. Read native total and its date; seed only when native date is stale
        let nativeTotal = await getTotalDailySteps();
        const nativeDate = await getDailyStepsDate();

        if (nativeDate !== today) {
          // Native service has no today data → inject SQLite baseline and realign
          if (baselineSteps > 0) {
            await setTotalDailySteps(baselineSteps);
            nativeTotal = baselineSteps;
            await resetSensorBaseline();
          }
        } else if (nativeTotal < baselineSteps) {
          // Rare: SQLite is ahead (e.g., another device sync) → catch up
          await setTotalDailySteps(baselineSteps);
          nativeTotal = baselineSteps;
          await resetSensorBaseline();
        }

        // 7. Set initial state
        const finalSteps = baselineSteps > 0 && nativeDate !== today ? baselineSteps : nativeTotal;
        if (mounted) {
          updateStepsFromNative(finalSteps > 0 ? finalSteps : 0);
          notifyWidget(finalSteps);
        }

        // 8. Poll native service every 2 seconds for real-time updates
        let lastKnownSteps = nativeTotal;
        pollInterval = setInterval(async () => {
          if (!mounted) return;
          try {
            const currentTotal = await getTotalDailySteps();
            if (currentTotal !== lastKnownSteps) {
              lastKnownSteps = currentTotal;
              updateStepsFromNative(currentTotal);
            }
          } catch {}
        }, 2000);

      } catch {
        if (mounted) handleTrackingUnavailable();
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

        // Ensure the service survived backgrounding, but ONLY if permissions are granted
        try {
          const perm = await Pedometer.getPermissionsAsync();
          if (perm.granted) {
            const running = await isBackgroundServiceRunning();
            if (!running) {
              await startBackgroundService();
            }
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
    trackingUnavailable,
    progressAnim,
    pulseAnim,
    goal: profile?.dailyStepGoal || 10000,
    goalReached: todaySteps >= (profile?.dailyStepGoal || 10000),
  };
}
