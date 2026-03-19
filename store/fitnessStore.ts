import { create } from 'zustand';
import { format } from 'date-fns';

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
  setTodayFloors: (floors: number) => void;
  setTodayActiveMinutes: (minutes: number) => void;
  recordDay: (data: Omit<DailySteps, 'date'>) => void;
  getWeekHistory: () => DailySteps[];
  calculateCalories: (steps: number, weight: number) => number;
  calculateDistance: (steps: number, height: number, useMetric: boolean) => number;
}

export const useFitnessStore = create<FitnessState>()((set, get) => ({
  todaySteps: 0,
  todayFloors: 0,
  todayActiveMinutes: 0,
  stepHistory: [],
  currentStreak: 0,
  setTodaySteps: (steps) => set({ todaySteps: steps }),
  setTodayFloors: (floors) => set({ todayFloors: floors }),
  setTodayActiveMinutes: (minutes) => set({ todayActiveMinutes: minutes }),
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
  calculateCalories: (steps, weight) => {
    return Math.round(steps * weight * 0.0005);
  },
  calculateDistance: (steps, height, useMetric) => {
    const strideMeters = height * 0.415;
    const distanceMeters = steps * strideMeters;
    return useMetric ? distanceMeters / 1000 : distanceMeters / 1609.34;
  },
}));
