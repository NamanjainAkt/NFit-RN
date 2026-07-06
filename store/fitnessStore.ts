import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { format } from 'date-fns';
import { zustandStorage } from '../utils/storage';
import { calculateCalories, calculateDistance } from '../utils/calculations';
import { useUserStore } from './userStore';

export interface DailySteps {
  date: string;
  steps: number;
  floors: number;
  activeMinutes: number;
  calories: number;
  distance: number;
}

interface FitnessState {
  todaySteps: number;
  todayFloors: number;
  todayActiveMinutes: number;
  stepHistory: DailySteps[];
  currentStreak: number;
  setTodaySteps: (steps: number) => void;
  syncTodayWithHistory: () => void;
  setTodayFloors: (floors: number) => void;
  setTodayActiveMinutes: (minutes: number) => void;
  recordDay: (data: Omit<DailySteps, 'date'>) => void;
  getWeekHistory: () => DailySteps[];
  getMonthHistory: () => DailySteps[];
  getYearHistory: () => DailySteps[];
}

// Debounced widget refresh to avoid excessive calls
let widgetRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedWidgetRefresh() {
  if (widgetRefreshTimeout) clearTimeout(widgetRefreshTimeout);
  widgetRefreshTimeout = setTimeout(() => {
    try {
      // Dynamic import to avoid circular dependency
      const { refreshWidget } = require('../utils/widgetBridge');
      refreshWidget();
    } catch {
      // Widget module not available - silently ignore
    }
  }, 2000);
}

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set, get) => ({
      todaySteps: 0,
      todayFloors: 0,
      todayActiveMinutes: 0,
      stepHistory: [],
      currentStreak: 0,
      setTodaySteps: (steps) => {
        set({ todaySteps: steps });
        get().syncTodayWithHistory();
        debouncedWidgetRefresh();
      },
      syncTodayWithHistory: () => {
        const { todaySteps, todayFloors, todayActiveMinutes, recordDay } = get();
        const profile = useUserStore.getState().profile;
        const calories = profile ? calculateCalories(todaySteps, profile.weight, profile.useMetric) : 0;
        const distance = profile ? calculateDistance(todaySteps, profile.height, profile.useMetric) : 0;
        recordDay({ steps: todaySteps, floors: todayFloors, activeMinutes: todayActiveMinutes, calories, distance });
      },
      setTodayFloors: (floors) => {
        set({ todayFloors: floors });
        get().syncTodayWithHistory();
      },
      setTodayActiveMinutes: (minutes) => {
        set({ todayActiveMinutes: minutes });
        get().syncTodayWithHistory();
      },
      recordDay: (data) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { stepHistory } = get();
        const existingIndex = stepHistory.findIndex((d) => d.date === today);
        if (existingIndex >= 0) {
          const updated = [...stepHistory];
          updated[existingIndex] = { ...data, date: today };
          set({ stepHistory: updated });
        } else {
          set({ stepHistory: [...stepHistory, { ...data, date: today }] });
        }
      },
      getWeekHistory: () => {
        const { stepHistory } = get();
        const today = new Date();
        const weekData: DailySteps[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const existing = stepHistory.find((d) => d.date === dateStr);
          weekData.push(existing || { date: dateStr, steps: 0, floors: 0, activeMinutes: 0, calories: 0, distance: 0 });
        }
        return weekData;
      },
      getMonthHistory: () => {
        const { stepHistory } = get();
        const today = new Date();
        const monthData: DailySteps[] = [];
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        for (let i = 0; i < daysInMonth; i++) {
          const date = new Date(today.getFullYear(), today.getMonth(), i + 1);
          const dateStr = format(date, 'yyyy-MM-dd');
          const existing = stepHistory.find((d) => d.date === dateStr);
          monthData.push(existing || { date: dateStr, steps: 0, floors: 0, activeMinutes: 0, calories: 0, distance: 0 });
        }
        return monthData;
      },
      getYearHistory: () => {
        const { stepHistory } = get();
        const today = new Date();
        const profile = useUserStore.getState().profile;
        const yearData: DailySteps[] = [];
        for (let month = 0; month <= today.getMonth(); month++) {
          const daysInMonth = new Date(today.getFullYear(), month + 1, 0).getDate();
          let monthSteps = 0;
          let monthFloors = 0;
          let monthActiveMinutes = 0;
          for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(today.getFullYear(), month, day);
            const dateStr = format(date, 'yyyy-MM-dd');
            const existing = stepHistory.find((d) => d.date === dateStr);
            if (existing) {
              monthSteps += existing.steps;
              monthFloors += existing.floors;
              monthActiveMinutes += existing.activeMinutes;
            }
          }
          yearData.push({
            date: `${today.getFullYear()}-${String(month + 1).padStart(2, '0')}-01`,
            steps: monthSteps,
            floors: monthFloors,
            activeMinutes: monthActiveMinutes,
            calories: profile ? calculateCalories(monthSteps, profile.weight, profile.useMetric) : 0,
            distance: profile ? calculateDistance(monthSteps, profile.height, profile.useMetric) : 0,
          });
        }
        return yearData;
      },
    }),
    {
      name: 'fitness-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
