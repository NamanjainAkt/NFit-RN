import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, AppState, AppStateStatus, Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import { Pedometer } from 'expo-sensors';
import { format } from 'date-fns';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { sendGoalReachedNotification, sendStreakNotification } from '../utils/notifications';
import { loadStepCounterState, saveStepCounterState, saveDailySteps, loadDailyStepsForDate, loadAllDailySteps } from '../utils/database';

export function useStepTracker() {
  const profile = useUserStore((state) => state.profile);
  const stepStreak = useUserStore((state) => state.stepStreak);
  const updateStepStreak = useUserStore((state) => state.updateStepStreak);
  const setStepHistory = useFitnessStore((state) => state.setStepHistory);

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

  const accumulatedRef = useRef(0);
  const sessionBaseRef = useRef(0);
  const maxDeltaRef = useRef(0);
  const lastEventTimeRef = useRef(0);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const shakeCooldownRef = useRef(0);
  const lastSensorStepsRef = useRef(0);
  const stepRateWindowRef = useRef<{ increment: number; time: number }[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const widgetModuleRef = useRef<any>(null);

  const persistSteps = useCallback(async (steps: number) => {
    await saveStepCounterState(steps);
    const today = format(new Date(), 'yyyy-MM-dd');
    await saveDailySteps({
      date: today,
      steps,
      floors: Math.floor(steps / 200),
      activeMinutes: Math.floor(steps / 100),
      calories: 0,
      distance: 0,
    });
  }, []);

  const syncWidget = useCallback(async (steps: number, goal: number) => {
    if (Platform.OS !== 'android') return;
    try {
      if (!widgetModuleRef.current) {
        widgetModuleRef.current = requireNativeModule('NfitWidgetModule');
      }
      await widgetModuleRef.current.updateWidget(steps, goal);
    } catch {}
  }, []);

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

    const sensorIncrement = lastSensorStepsRef.current === 0 ? 0 : delta - lastSensorStepsRef.current;
    lastSensorStepsRef.current = delta;

    if (sensorIncrement > 15) {
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

  useEffect(() => {
    const init = async () => {
      const state = await loadStepCounterState();
      const today = format(new Date(), 'yyyy-MM-dd');

      if (state.lastUpdatedDate !== today) {
        accumulatedRef.current = 0;
        await saveStepCounterState(0);
      } else {
        accumulatedRef.current = state.accumulatedSteps;
      }

      const saved = await loadDailyStepsForDate(today);
      if (saved) {
        setTodaySteps(saved.steps);
        setTodayFloors(saved.floors);
        setTodayActiveMinutes(saved.activeMinutes);
        const goal = profileRef.current?.dailyStepGoal || 10000;
        syncWidget(saved.steps, goal);
      } else {
        const loaded = state.lastUpdatedDate === today ? state.accumulatedSteps : 0;
        setTodaySteps(loaded);
        const goal = profileRef.current?.dailyStepGoal || 10000;
        syncWidget(loaded, goal);
      }

      loadAllDailySteps().then((all) => {
        setStepHistory(all);
      });

      setIsSimulated(false);
      await startWatching();
    };

    init();

    saveTimerRef.current = setInterval(async () => {
      const steps = accumulatedRef.current + Math.max(0, (maxDeltaRef.current || 0) - (sessionBaseRef.current || 0));
      await persistSteps(steps);
    }, 30000);

    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        const steps = accumulatedRef.current + Math.max(0, (maxDeltaRef.current || 0) - (sessionBaseRef.current || 0));
        await persistSteps(steps);
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (subscriptionRef.current) subscriptionRef.current.remove();
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
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
    goalReached: todaySteps >= (profile?.dailyStepGoal || 10000)
  };
}
