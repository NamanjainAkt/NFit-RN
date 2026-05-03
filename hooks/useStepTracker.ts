import { useState, useEffect, useRef } from 'react';
import { Platform, Animated } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { format } from 'date-fns';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { sendGoalReachedNotification, sendStreakNotification } from '../utils/notifications';

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

  useEffect(() => {
    checkPedometer();
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

  const simulateSteps = () => {
    setIsSimulated(true);
    const simulatedSteps = Math.floor(Math.random() * 5000) + 1000;
    setTodaySteps(simulatedSteps);
    setTodayFloors(Math.floor(simulatedSteps / 200));
    setTodayActiveMinutes(Math.floor(simulatedSteps / 100));
  };

  const checkPedometer = async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) { 
        simulateSteps();
        return; 
      }
      
      const result = await Pedometer.requestPermissionsAsync();
      if (result.granted) {
        const sub = Pedometer.watchStepCount((data) => {
          setTodaySteps(data.steps);
          setTodayFloors(Math.floor(data.steps / 200));
          setTodayActiveMinutes(Math.floor(data.steps / 100));
          
          if (profile) {
            const goal = profile.dailyStepGoal || 10000;
            if (data.steps >= goal) {
              updateStepStreak(format(new Date(), 'yyyy-MM-dd'));
            }
          }
        });
        return () => sub && sub.remove();
      } else { 
        simulateSteps();
      }
    } catch (e) {
      simulateSteps();
    }
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
