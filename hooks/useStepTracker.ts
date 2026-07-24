import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { Pedometer, Accelerometer } from 'expo-sensors';
import { format } from 'date-fns';
import { StepDetector } from '../utils/stepDetector';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { loadDailyStepsForDate, saveStepCounterState } from '../utils/database';
import { sendGoalReachedNotification, sendStreakNotification } from '../utils/notifications';
import { refreshWidget, getAccumulatedSteps, resetAccumulatedSteps } from '../utils/widgetBridge';
import { createStepFilterState, processStepDelta } from '../utils/stepFilter';

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

        let baselineSteps = 0;
        let baselineFloors = 0;
        let baselineActiveMinutes = 0;

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
            restoreFromHistory();
          }
        } catch {
          restoreFromHistory();
        }

        const preBgSteps = baselineSteps;
        const preBgFloors = baselineFloors;
        const preBgActiveMinutes = baselineActiveMinutes;
        try {
          const bgSteps = await getAccumulatedSteps();
          if (bgSteps > 0) {
            baselineSteps += bgSteps;
            const addedFloors = Math.floor(bgSteps / 200);
            const addedMinutes = Math.floor(bgSteps / 100);
            baselineFloors += addedFloors;
            baselineActiveMinutes += addedMinutes;
            await resetAccumulatedSteps();
          }
        } catch {
        }

        if (mounted) {
          setTodaySteps(baselineSteps);
          setTodayFloors(baselineFloors);
          setTodayActiveMinutes(baselineActiveMinutes);
          notifyWidget(baselineSteps);
        }

        const available = await Pedometer.isAvailableAsync();
        if (!available) {
          if (mounted) simulateSteps();
          return;
        }

        const accAvailable = await Accelerometer.isAvailableAsync();
        const permResult = await Pedometer.requestPermissionsAsync();
        
        if (permResult.granted) {
          let lastWidgetNotifySteps = baselineSteps;
          
          if (accAvailable) {
            // Use robust accelerometer StepDetector in foreground
            Accelerometer.setUpdateInterval(50); // 20Hz
            const detector = new StepDetector({}, (count) => {
              if (!mounted) return;
              
              // Only process positive deltas
              const sessionDelta = count - (detector as any).sessionSteps;
              if (sessionDelta > 0) {
                (detector as any).sessionSteps = count;
                const totalSteps = stepsRef.current + sessionDelta;
                const totalFloors = Math.floor(totalSteps / 200);
                const totalActiveMinutes = Math.floor(totalSteps / 100);

                setTodaySteps(totalSteps);
                setTodayFloors(totalFloors);
                setTodayActiveMinutes(totalActiveMinutes);

                saveStepCounterState(totalSteps).catch(() => {});

                if (totalSteps - lastWidgetNotifySteps >= 50) {
                  notifyWidget(totalSteps);
                  lastWidgetNotifySteps = totalSteps;
                }
              }
            });
            (detector as any).sessionSteps = 0;

            subscription = Accelerometer.addListener(({ x, y, z }) => {
              detector.addSample({
                x: x * 9.81,
                y: y * 9.81,
                z: z * 9.81,
                timestamp: Date.now(),
              });
            });
          } else {
            // Fallback to naive pedometer watch
            let filterState = createStepFilterState();
            subscription = Pedometer.watchStepCount((data) => {
              if (!mounted) return;

              const { newState, acceptedDelta } = processStepDelta(
                filterState,
                data.steps,
                Date.now()
              );
              filterState = newState;

              if (acceptedDelta <= 0) return;

              const totalSteps = stepsRef.current + acceptedDelta;
              const totalFloors = Math.floor(totalSteps / 200);
              const totalActiveMinutes = Math.floor(totalSteps / 100);

              setTodaySteps(totalSteps);
              setTodayFloors(totalFloors);
              setTodayActiveMinutes(totalActiveMinutes);

              saveStepCounterState(totalSteps).catch(() => {});

              if (totalSteps - lastWidgetNotifySteps >= 50) {
                notifyWidget(totalSteps);
                lastWidgetNotifySteps = totalSteps;
              }
            });
          }
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

  // Reset goal notification at midnight or when steps drop
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
