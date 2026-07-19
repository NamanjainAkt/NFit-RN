# Data Flow

> How step data moves through the system

## Step Data Pipeline (Foreground)

```
Pedometer Sensor (expo-sensors)
    ↓ watchStepCount(data) [incremental since subscription]
useStepTracker
    ↓ adds to baseline → setTodaySteps(totalSteps)
fitnessStore
    ├→ syncTodayWithHistory() → recordDay() → stepHistory[]
    ├→ debouncedWidgetRefresh() (2s) → widgetBridge.refreshWidget() → Native Widget
    └→ debouncedDbSave() (3s) → database.saveDailySteps() → SQLite daily_steps
```

## Step Data Pipeline (Background — App Closed)

```
TYPE_STEP_COUNTER (hardware, monotonic)
    ↓ read every 15 min
StepTrackerWorker (WorkManager)
    ↓ computes delta from last saved total
SharedPrefs (nfit_background_steps)
    ↓ on next app open
getAccumulatedSteps() (native bridge)
    ↓ read by useStepTracker as baseline
JS Pedometer adds incremental on top of WorkManager baseline
```

## Step 1: Baseline Restoration (on app start)
`useStepTracker` runs a 3-stage restore on mount:

1. **SQLite** — reads `daily_steps` for today. If found and > 0, use as baseline.
2. **WorkManager** — calls `getAccumulatedSteps()` via native bridge. If higher than SQLite baseline (user walked while app was closed), overrides baseline and scales floors/activeMinutes proportionally.
3. **Zustand fallback** — if both SQLite and native module fail, falls back to `stepHistory[]` from Zustand's persisted state.

## Step 2: Sensor to Hook
`useStepTracker` subscribes to `Pedometer.watchStepCount()`. The callback receives `data.steps` (incremental since subscription start). The hook adds this to the restored baseline.

## Step 3: Hook to Store
`setTodaySteps(totalSteps)` is called on the fitness store, which:
1. Updates `todaySteps` in memory
2. Calls `syncTodayWithHistory()` to upsert today's entry in `stepHistory[]`
3. Triggers debounced widget refresh (2s)
4. Triggers debounced SQLite save (3s)

## Step 4: Store to SQLite
The debounced save reads the latest state from both stores, calculates calories/distance, and writes to the `daily_steps` table via `saveDailySteps()`.

## Step 5: Store to Widget
The debounced refresh reads from stores and calls `refreshWidget()` which pushes data to the native `NfitWidget` module.

## Step 6: Store to UI
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
- Background steps are never lost — WorkManager reads the monotonic hardware counter
