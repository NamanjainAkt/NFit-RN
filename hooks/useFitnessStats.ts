import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { calculateCalories, calculateDistance } from '../utils/calculations';

export function useFitnessStats() {
  const profile = useUserStore((state) => state.profile);
  const stepStreak = useUserStore((state) => state.stepStreak);
  const lastActiveDate = useUserStore((state) => state.lastActiveDate);

  const {
    todaySteps,
    todayFloors,
    todayActiveMinutes
  } = useFitnessStore();

  if (!profile) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  
  let activeStreak = stepStreak;
  if (lastActiveDate) {
    const lastActive = new Date(lastActiveDate);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate.getTime() - lastActive.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If the last active date was more than 1 day ago, the streak is broken (unless they met the goal today)
    if (diffDays > 1) {
      activeStreak = 0;
    }
  }

  const workouts = useUserStore((state) => state.workouts);
  
  const baseCalories = calculateCalories(todaySteps, profile.weight, profile.useMetric);
  const workoutCalories = workouts
    .filter(w => w.date === todayStr)
    .reduce((sum, w) => sum + (Number(w.calories) || 0), 0);
  const calories = baseCalories + workoutCalories;
  const distance = calculateDistance(todaySteps, profile.height, profile.useMetric);
  const distanceUnit = profile.useMetric ? 'km' : 'mi';

  return {
    profile,
    todaySteps,
    todayFloors,
    todayActiveMinutes,
    stepStreak: activeStreak,
    calories,
    distance,
    distanceUnit,
    goal: profile.dailyStepGoal || 10000,
    goalReached: todaySteps >= (profile.dailyStepGoal || 10000)
  };
}
