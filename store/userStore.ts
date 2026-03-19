import { create } from 'zustand';

export interface UserProfile {
  name: string;
  weight: number;
  height: number;
  age: number;
  dailyStepGoal: number;
  useMetric: boolean;
  darkMode: boolean;
}

interface UserState {
  profile: UserProfile | null;
  hasCompletedOnboarding: boolean;
  stepStreak: number;
  lastActiveDate: string | null;
  setProfile: (profile: UserProfile) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  updateStepStreak: (today: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

export const useUserStore = create<UserState>()((set, get) => ({
  profile: null,
  hasCompletedOnboarding: false,
  stepStreak: 0,
  lastActiveDate: null,
  setProfile: (profile) => set({ profile, hasCompletedOnboarding: true }),
  setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
  updateStepStreak: (today) => {
    const { lastActiveDate, stepStreak } = get();
    if (!lastActiveDate) {
      set({ stepStreak: 1, lastActiveDate: today });
      return;
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (lastActiveDate === yesterdayStr) {
      set({ stepStreak: stepStreak + 1, lastActiveDate: today });
    } else if (lastActiveDate !== today) {
      set({ stepStreak: 1, lastActiveDate: today });
    }
  },
  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    })),
}));
