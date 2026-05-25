import * as SQLite from 'expo-sqlite';
import { format } from 'date-fns';
import type { UserProfile, Workout } from '../store/userStore';
import type { DailySteps } from '../store/fitnessStore';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('nfit.db');
    await initTables();
  }
  return db;
}

async function initTables() {
  const d = db!;
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_steps (
      date TEXT PRIMARY KEY,
      steps INTEGER NOT NULL DEFAULT 0,
      floors INTEGER NOT NULL DEFAULT 0,
      active_minutes INTEGER NOT NULL DEFAULT 0,
      calories REAL NOT NULL DEFAULT 0,
      distance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS step_counter_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      accumulated_steps INTEGER NOT NULL DEFAULT 0,
      last_updated_date TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      duration INTEGER NOT NULL,
      calories INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL DEFAULT '',
      weight REAL NOT NULL DEFAULT 70,
      height REAL NOT NULL DEFAULT 170,
      age INTEGER NOT NULL DEFAULT 25,
      daily_step_goal INTEGER NOT NULL DEFAULT 10000,
      daily_calorie_goal INTEGER NOT NULL DEFAULT 2000,
      weight_goal REAL NOT NULL DEFAULT 70,
      weekly_workout_goal INTEGER NOT NULL DEFAULT 5,
      use_metric INTEGER NOT NULL DEFAULT 1,
      dark_mode INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const today = format(new Date(), 'yyyy-MM-dd');
  await d.runAsync(
    `INSERT OR IGNORE INTO step_counter_state (id, accumulated_steps, last_updated_date, updated_at)
     VALUES (1, 0, ?, ?)`,
    today,
    new Date().toISOString()
  );

  await d.runAsync(
    `INSERT OR IGNORE INTO profile (id) VALUES (1)`
  );
}

// ── Step counter state ──

export async function loadStepCounterState(): Promise<{ accumulatedSteps: number; lastUpdatedDate: string }> {
  const d = await getDb();
  const row = await d.getFirstAsync<{ accumulated_steps: number; last_updated_date: string }>(
    `SELECT accumulated_steps, last_updated_date FROM step_counter_state WHERE id = 1`
  );
  return { accumulatedSteps: row?.accumulated_steps ?? 0, lastUpdatedDate: row?.last_updated_date ?? '' };
}

export async function saveStepCounterState(accumulatedSteps: number) {
  const d = await getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  await d.runAsync(
    `UPDATE step_counter_state SET accumulated_steps = ?, last_updated_date = ?, updated_at = ? WHERE id = 1`,
    accumulatedSteps,
    today,
    new Date().toISOString()
  );
}

// ── Daily steps ──

export async function saveDailySteps(entry: DailySteps) {
  const d = await getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO daily_steps (date, steps, floors, active_minutes, calories, distance)
     VALUES (?, ?, ?, ?, ?, ?)`,
    entry.date,
    entry.steps,
    entry.floors,
    entry.activeMinutes,
    entry.calories,
    entry.distance
  );
}

export async function loadDailyStepsForDate(date: string): Promise<DailySteps | null> {
  const d = await getDb();
  const row = await d.getFirstAsync<{
    date: string; steps: number; floors: number; active_minutes: number; calories: number; distance: number;
  }>(
    `SELECT * FROM daily_steps WHERE date = ?`, date
  );
  if (!row) return null;
  return {
    date: row.date,
    steps: row.steps,
    floors: row.floors,
    activeMinutes: row.active_minutes,
    calories: row.calories,
    distance: row.distance,
  };
}

export async function loadAllDailySteps(): Promise<DailySteps[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<{
    date: string; steps: number; floors: number; active_minutes: number; calories: number; distance: number;
  }>(`SELECT * FROM daily_steps ORDER BY date ASC`);
  return rows.map((r) => ({
    date: r.date,
    steps: r.steps,
    floors: r.floors,
    activeMinutes: r.active_minutes,
    calories: r.calories,
    distance: r.distance,
  }));
}

// ── Workouts ──

export async function saveWorkout(workout: Workout) {
  const d = await getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO workouts (id, type, duration, calories, date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    workout.id,
    workout.type,
    workout.duration,
    workout.calories,
    workout.date,
    workout.notes ?? ''
  );
}

export async function deleteWorkout(id: string) {
  const d = await getDb();
  await d.runAsync(`DELETE FROM workouts WHERE id = ?`, id);
}

export async function loadAllWorkouts(): Promise<Workout[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<{
    id: string; type: string; duration: number; calories: number; date: string; notes: string;
  }>(`SELECT * FROM workouts ORDER BY date DESC`);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    duration: r.duration,
    calories: r.calories,
    date: r.date,
    notes: r.notes || undefined,
  }));
}

// ── Profile ──

export async function saveProfile(profile: UserProfile) {
  const d = await getDb();
  await d.runAsync(
    `UPDATE profile SET
      name = ?, weight = ?, height = ?, age = ?,
      daily_step_goal = ?, daily_calorie_goal = ?, weight_goal = ?,
      weekly_workout_goal = ?, use_metric = ?, dark_mode = ?
     WHERE id = 1`,
    profile.name,
    profile.weight,
    profile.height,
    profile.age,
    profile.dailyStepGoal,
    profile.dailyCalorieGoal,
    profile.weightGoal,
    profile.weeklyWorkoutGoal,
    profile.useMetric ? 1 : 0,
    profile.darkMode ? 1 : 0
  );
}

export async function loadProfile(): Promise<UserProfile | null> {
  const d = await getDb();
  const row = await d.getFirstAsync<{
    name: string; weight: number; height: number; age: number;
    daily_step_goal: number; daily_calorie_goal: number; weight_goal: number;
    weekly_workout_goal: number; use_metric: number; dark_mode: number;
  }>(`SELECT * FROM profile WHERE id = 1`);
  if (!row) return null;
  return {
    name: row.name || '',
    weight: row.weight,
    height: row.height,
    age: row.age,
    dailyStepGoal: row.daily_step_goal,
    dailyCalorieGoal: row.daily_calorie_goal,
    weightGoal: row.weight_goal,
    weeklyWorkoutGoal: row.weekly_workout_goal,
    useMetric: row.use_metric === 1,
    darkMode: row.dark_mode === 1,
  };
}

// ── App state key-value ──

export async function getAppState(key: string): Promise<string | null> {
  const d = await getDb();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_state WHERE key = ?`, key
  );
  return row?.value ?? null;
}

export async function setAppState(key: string, value: string) {
  const d = await getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)`, key, value
  );
}

export async function deleteAppState(key: string) {
  const d = await getDb();
  await d.runAsync(`DELETE FROM app_state WHERE key = ?`, key);
}
