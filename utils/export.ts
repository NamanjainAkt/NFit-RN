import * as FileSystem from 'expo-file-system/legacy';
import Sharing from 'expo-sharing';
import { DailySteps } from '../store/fitnessStore';
import { Workout } from '../store/userStore';

export interface ExportData {
  profile: {
    name: string;
    weight: number;
    height: number;
    age: number;
    dailyStepGoal: number;
    dailyCalorieGoal: number;
    weightGoal: number;
    weeklyWorkoutGoal: number;
  };
  stepHistory: DailySteps[];
  workouts: Workout[];
  exportedAt: string;
}

export function exportToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function exportToCSV(stepHistory: DailySteps[]): string {
  const headers = 'Date,Steps,Floors,Active Minutes,Calories,Distance\n';
  const rows = stepHistory
    .map((d) => `${d.date},${d.steps},${d.floors},${d.activeMinutes},${d.calories},${d.distance}`)
    .join('\n');
  return headers + rows;
}

export function exportWorkoutsToCSV(workouts: Workout[]): string {
  const headers = 'Date,Type,Duration (min),Calories,Notes\n';
  const rows = workouts
    .map((w) => `${w.date},${w.type},${w.duration},${w.calories},"${(w.notes || '').replace(/"/g, '""')}"`)
    .join('\n');
  return headers + rows;
}

export async function shareData(data: ExportData, format: 'json' | 'csv'): Promise<boolean> {
  try {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = exportToJSON(data);
      filename = `nfit-export-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      const stepCsv = exportToCSV(data.stepHistory);
      const workoutCsv = exportWorkoutsToCSV(data.workouts);
      content = `=== STEP DATA ===\n${stepCsv}\n\n=== WORKOUT DATA ===\n${workoutCsv}`;
      filename = `nfit-export-${Date.now()}.csv`;
      mimeType = 'text/csv';
    }

    const fileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, content);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Export Nfit Data',
      });
      return true;
    }
    return false;
  } catch {
    // Silently fail in production
    return false;
  }
}
