# Data Flow

> How step data moves through the system

## Step Data Pipeline

```
Pedometer Sensor (expo-sensors)
    ↓ watchStepCount(data)
useStepTracker
    ↓ setTodaySteps(totalSteps)
fitnessStore
    ├→ syncTodayWithHistory() → recordDay() → stepHistory[]
    ├→ debouncedWidgetRefresh() (2s) → widgetBridge.refreshWidget() → Native Widget
    └→ debouncedDbSave() (3s) → database.saveDailySteps() → SQLite daily_steps
```

## Step 1: Sensor to Hook
`useStepTracker` subscribes to `Pedometer.watchStepCount()`. The callback receives `data.steps` (incremental since subscription start). The hook adds this to a **baseline** restored from SQLite to avoid losing steps on app restart.

## Step 2: Hook to Store
`setTodaySteps(totalSteps)` is called on the fitness store, which:
1. Updates `todaySteps` in memory
2. Calls `syncTodayWithHistory()` to upsert today's entry in `stepHistory[]`
3. Triggers debounced widget refresh (2s)
4. Triggers debounced SQLite save (3s)

## Step 3: Store to SQLite
The debounced save reads the latest state from both stores, calculates calories/distance, and writes to the `daily_steps` table via `saveDailySteps()`.

## Step 4: Store to Widget
The debounced refresh reads from stores and calls `refreshWidget()` which pushes data to the native `NfitWidget` module.

## Step 5: Store to UI
Screens read from stores via selectors:
- Home: `useStepTracker()` + `useFitnessStats()` — reads todaySteps, calories, distance, goal
- History: `getWeekHistory()`, `getMonthHistory()`, `getYearHistory()` — reads stepHistory
- Analytics: `stepHistory` filtered by date range

## Workout Flow
```
Workout Wizard (workouts.tsx)
    ↓ addWorkout({ type, duration, calories, notes })
userStore
    ├→ workouts[] (in memory)
    └→ persisted to user-storage via zustandStorage
```

Workouts are stored in Zustand only (no SQLite table writes currently, despite the table existing).

## Key Invariants
- `todaySteps` is always the **accumulated total** for today (baseline + sensor increments)
- `stepHistory[]` is updated synchronously on every `setTodaySteps` call
- Widget and SQLite writes are debounced to avoid excessive I/O
