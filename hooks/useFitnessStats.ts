import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';

export function useFitnessStats() {
  const profile = useUserStore((state) => state.profile);
  const stepStreak = useUserStore((state) => state.stepStreak);
  
  const { 
    todaySteps, 
    todayFloors, 
    todayActiveMinutes, 
    calculateCalories, 
    calculateDistance 
  } = useFitnessStore();

  if (!profile) return null;

  const calories = calculateCalories(todaySteps, profile.weight, profile.useMetric);
  const distance = calculateDistance(todaySteps, profile.height, profile.useMetric);
  const distanceUnit = profile.useMetric ? 'km' : 'mi';

  return {
    profile,
    todaySteps,
    todayFloors,
    todayActiveMinutes,
    stepStreak,
    calories,
    distance,
    distanceUnit,
    goal: profile.dailyStepGoal || 10000,
    goalReached: todaySteps >= (profile.dailyStepGoal || 10000)
  };
}
