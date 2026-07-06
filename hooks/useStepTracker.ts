import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { format } from 'date-fns';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
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
      await refreshWidget();
    } catch {
      // Widget may not be available
    }
  }, []);

  const simulateSteps = () => {
    setIsSimulated(true);
    const simulatedSteps = Math.floor(Math.random() * 5000) + 1000;
    setTodaySteps(simulatedSteps);
    setTodayFloors(Math.floor(simulatedSteps / 200));
    setTodayActiveMinutes(Math.floor(simulatedSteps / 100));

    // Update streak for simulated steps too
    if (simulatedSteps > 0) {
      updateStepStreak(format(new Date(), 'yyyy-MM-dd'));
    }
  };

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let mounted = true;
    let stepAccumulator = 0;
    let lastNotifiedSteps = 0;

    const setup = async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!available) {
          if (mounted) simulateSteps();
          return;
        }

        const result = await Pedometer.requestPermissionsAsync();
        if (result.granted) {
          subscription = Pedometer.watchStepCount((data) => {
            const steps = data.steps;
            setTodaySteps(steps);
            setTodayFloors(Math.floor(steps / 200));
            setTodayActiveMinutes(Math.floor(steps / 100));

            // Update streak on ANY step activity
            if (steps > 0) {
              updateStepStreak(format(new Date(), 'yyyy-MM-dd'));
            }

            // Sync to widget
            stepAccumulator += steps - lastNotifiedSteps;
            if (stepAccumulator >= 50 || steps !== lastNotifiedSteps) {
              notifyWidget(steps);
              stepAccumulator = 0;
              lastNotifiedSteps = steps;
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
