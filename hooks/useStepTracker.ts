import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { format } from 'date-fns';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { loadDailyStepsForDate, saveDailySteps, saveStepCounterState } from '../utils/database';
import { sendGoalReachedNotification, sendStreakNotification } from '../utils/notifications';
import { refreshWidget, startBackgroundService, stopBackgroundService as stopBg } from '../utils/widgetBridge';

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
  const [isBackgroundTracking, setIsBackgroundTracking] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const stepsRef = useRef(todaySteps);
  stepsRef.current = todaySteps;

  // Emit steps to widget whenever they change
  const notifyWidget = useCallback(async (_steps: number) => {
    try {
      const res = await refreshWidget();
      console.log('[useStepTracker] refreshWidget result:', res);
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

  // ── Main setup: restore persisted steps + start pedometer ──
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let mounted = true;

    const setup = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');

        // 1. Restore today's persisted steps from SQLite as baseline
        let baselineSteps = 0;
        let baselineFloors = 0;
        let baselineActiveMinutes = 0;

        // Helper: fall back to Zustand's persisted stepHistory (rehydrated from app_state)
        const restoreFromHistory = () => {
          const { stepHistory } = useFitnessStore.getState();
          const todayEntry = stepHistory.find((d) => d.date === today);
          if (todayEntry && todayEntry.steps > 0) {
            baselineSteps = todayEntry.steps;
            baselineFloors = todayEntry.floors;
            baselineActiveMinutes = todayEntry.activeMinutes;
          }
        };

        try {
          const saved = await loadDailyStepsForDate(today);
          if (saved && saved.steps > 0) {
            baselineSteps = saved.steps;
            baselineFloors = saved.floors;
            baselineActiveMinutes = saved.activeMinutes;
          } else {
            // No SQLite row (debounced save hadn't fired before last kill);
            // fall back to Zustand stepHistory which was persisted synchronously
            restoreFromHistory();
          }
        } catch {
          // SQLite not ready; fall back to Zustand stepHistory
          restoreFromHistory();
        }

        // Apply restored baseline immediately so UI shows saved data
        if (mounted) {
          setTodaySteps(baselineSteps);
          setTodayFloors(baselineFloors);
          setTodayActiveMinutes(baselineActiveMinutes);
          notifyWidget(baselineSteps);
        }

        // 2. Start pedometer subscription
        const available = await Pedometer.isAvailableAsync();
        if (!available) {
          if (mounted) simulateSteps();
          return;
        }

        const result = await Pedometer.requestPermissionsAsync();
        if (result.granted) {
          let lastWidgetNotifySteps = baselineSteps;

          subscription = Pedometer.watchStepCount((data) => {
            if (!mounted) return;

            // data.steps = steps accumulated since subscription started (NOT daily total).
            // Add on top of the restored baseline so we don't lose pre-restart steps.
            const totalSteps = baselineSteps + data.steps;
            const totalFloors = baselineFloors + Math.floor(data.steps / 200);
            const totalActiveMinutes = baselineActiveMinutes + Math.floor(data.steps / 100);

            setTodaySteps(totalSteps);
            setTodayFloors(totalFloors);
            setTodayActiveMinutes(totalActiveMinutes);

            // Persist accumulated step counter state
            saveStepCounterState(totalSteps).catch(() => {});

            // Sync to widget every 50 steps to avoid excessive updates
            if (totalSteps - lastWidgetNotifySteps >= 50) {
              notifyWidget(totalSteps);
              lastWidgetNotifySteps = totalSteps;
            }
          });
        } else {
          if (mounted) simulateSteps();
        }
      } catch {
        if (mounted) simulateSteps();
      }
    };

    setup();

    return () => {
      mounted = false;
      if (subscription) subscription.remove();
    };
  }, []);

  // Sync to widget when profile loads or changes (e.g. onboarding completion)
  useEffect(() => {
    if (profile) {
      notifyWidget(todaySteps);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const goal = profile.dailyStepGoal || 10000;
      const progress = Math.min(todaySteps / goal, 1);

      // Use Animated.timing with useNativeDriver: true for transform-only
      Animated.timing(progressAnim, {
        toValue: progress,
        useNativeDriver: true,
        duration: 300,
      }).start();

      if (progress >= 1 && !goalNotified) {
        setGoalNotified(true);
        sendGoalReachedNotification(todaySteps);
        updateStepStreak(format(new Date(), 'yyyy-MM-dd'), true);

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

  // Reset goal notification at midnight or when steps drop
  useEffect(() => {
    if (todaySteps < (profile?.dailyStepGoal || 10000)) {
      setGoalNotified(false);
    }
  }, [todaySteps, profile]);

  const startBackgroundTracking = async () => {
    try {
      await startBackgroundService();
      setIsBackgroundTracking(true);
    } catch {
      // Fallback to foreground tracking
    }
  };

  const stopBackgroundTracking = async () => {
    try {
      await stopBg();
      setIsBackgroundTracking(false);
    } catch {
      // Fallback
    }
  };

  return {
    todaySteps,
    isSimulated,
    progressAnim,
    pulseAnim,
    goal: profile?.dailyStepGoal || 10000,
    goalReached: todaySteps >= (profile?.dailyStepGoal || 10000),
    isBackgroundTracking,
    startBackgroundTracking,
    stopBackgroundTracking,
  };
}
