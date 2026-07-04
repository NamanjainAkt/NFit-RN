import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '../utils/storage';
import { format, subDays, isSameDay, parseISO } from 'date-fns';

export interface UserProfile {
  name: string;
  weight: number;
  height: number;
  age: number;
  dailyStepGoal: number;
  dailyCalorieGoal: number;
  weightGoal: number;
  weeklyWorkoutGoal: number;
  useMetric: boolean;
  darkMode: boolean;
}

export interface Workout {
  id: string;
  type: string;
  duration: number;
  calories: number;
  date: string;
  notes?: string;
}

export interface WorkoutGoal {
  type: string;
  target: number;
  period: 'daily' | 'weekly';
}

interface UserState {
  profile: UserProfile | null;
  hasCompletedOnboarding: boolean;
  stepStreak: number;
  lastActiveDate: string | null;
  workouts: Workout[];
  workoutGoals: WorkoutGoal[];
  setProfile: (profile: UserProfile) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  updateStepStreak: (today: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  resetData: () => void;
  addWorkout: (workout: Omit<Workout, 'id' | 'date'>) => void;
  removeWorkout: (id: string) => void;
  getWorkouts: () => Workout[];
  getWorkoutsForWeek: () => Workout[];
  setWorkoutGoal: (goal: WorkoutGoal) => void;
  backgroundTrackingEnabled: boolean;
  setBackgroundTrackingEnabled: (value: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      hasCompletedOnboarding: false,
      stepStreak: 0,
      lastActiveDate: null,
      workouts: [],
      workoutGoals: [],
      backgroundTrackingEnabled: true,
      setProfile: (profile) => set({ profile, hasCompletedOnboarding: true }),
      setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
      setBackgroundTrackingEnabled: (value) => set({ backgroundTrackingEnabled: value }),
      updateStepStreak: (today) => {
        const { lastActiveDate, stepStreak } = get();
        const todayDate = parseISO(today);
        
        if (!lastActiveDate) {
          set({ stepStreak: 1, lastActiveDate: today });
          return;
        }

        const lastDate = parseISO(lastActiveDate);
        const yesterday = subDays(todayDate, 1);

        if (isSameDay(lastDate, todayDate)) {
          // Already active today, do nothing
          return;
        }

        if (isSameDay(lastDate, yesterday)) {
          set({ stepStreak: stepStreak + 1, lastActiveDate: today });
        } else {
          set({ stepStreak: 1, lastActiveDate: today });
        }
      },
      updateProfile: (updates) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
        })),
      addWorkout: (workout) => {
        const newWorkout: Workout = {
          ...workout,
          id: Date.now().toString(),
          date: format(new Date(), 'yyyy-MM-dd'),
        };
        set((state) => ({ workouts: [...state.workouts, newWorkout] }));
      },
  resetData: () => set({
    profile: null,
    hasCompletedOnboarding: false,
    stepStreak: 0,
    lastActiveDate: null,
    workouts: [],
    workoutGoals: [],
    backgroundTrackingEnabled: true,
  }),
  removeWorkout: (id) => {
    set((state) => ({ workouts: state.workouts.filter((w) => w.id !== id) }));
  },
      getWorkouts: () => {
        return get().workouts;
      },
      getWorkoutsForWeek: () => {
        const { workouts } = get();
        // Use string comparison on yyyy-MM-dd — lexicographically correct and
        // timezone-safe for any user in the world (avoids UTC-parse of date strings).
        const weekAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        return workouts.filter((w) => w.date >= weekAgoStr);
      },
      setWorkoutGoal: (goal) => {
        set((state) => ({
          workoutGoals: [...state.workoutGoals.filter((g) => g.type !== goal.type), goal],
        }));
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
