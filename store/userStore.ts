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
  updateStepStreak: (today: string, goalReached: boolean) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addWorkout: (workout: Omit<Workout, 'id' | 'date'>) => void;
  removeWorkout: (id: string) => void;
  getWorkouts: () => Workout[];
  getWorkoutsForWeek: () => Workout[];
  setWorkoutGoal: (goal: WorkoutGoal) => void;
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
      setProfile: (profile) => set({ profile, hasCompletedOnboarding: true }),
      setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
      updateStepStreak: (today, goalReached) => {
        if (!goalReached) return;

        const { lastActiveDate, stepStreak } = get();
        const todayDate = parseISO(today);

        if (!lastActiveDate) {
          set({ stepStreak: 1, lastActiveDate: today });
          return;
        }

        const lastDate = parseISO(lastActiveDate);
        const yesterday = subDays(todayDate, 1);

        if (isSameDay(lastDate, todayDate)) {
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
        try { require('./fitnessStore').useFitnessStore.getState().syncTodayWithHistory(); } catch(e) {}
      },
      removeWorkout: (id) => {
        set((state) => ({ workouts: state.workouts.filter((w) => w.id !== id) }));
        try { require('./fitnessStore').useFitnessStore.getState().syncTodayWithHistory(); } catch(e) {}
      },
      getWorkouts: () => {
        return get().workouts;
      },
      getWorkoutsForWeek: () => {
        const { workouts } = get();
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return workouts.filter((w) => new Date(w.date) >= weekAgo);
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
