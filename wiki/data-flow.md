# Data Flow

> How step data moves through the system

## Step Data Pipeline (Single Source of Truth)

The native `StepTrackerService` (Android foreground service) is the **sole step counter** for both foreground and background. The JS layer only **reads** from the service — it never counts independently.

```
TYPE_STEP_COUNTER (hardware sensor, built-in shake rejection)
    → StepTrackerService (foreground service, always running)
    → SharedPreferences (daily_total_steps, daily_steps_date)
    → Widget broadcast every 10 steps
    → getTotalDailySteps() polled by JS every 2 seconds
useStepTracker
    → setTodaySteps(nativeTotal)
fitnessStore
    → syncTodayWithHistory() → recordDay() → stepHistory[]
    → debouncedWidgetRefresh() (2s) → widgetBridge.refreshWidget() → Native Widget
    → debouncedDbSave() (3s) → database.saveDailySteps() → SQLite daily_steps
```

## Step 1: Baseline Restoration & Seeding (on app start)
`useStepTracker` restores today's total in stages:

1. **SQLite** - reads `daily_steps` for today. If found and > 0, use as baseline.
2. **Zustand fallback** - if SQLite is empty or fails, uses today's entry from `stepHistory[]`.
3. **Native comparison** - reads `getTotalDailySteps()` and `getDailyStepsDate()`. If native date is stale, it injects the baseline and forces a `resetSensorBaseline()`. If native total is < baseline, it seeds native with the baseline.

## Step 2: Native Service Lifecycle
After `ACTIVITY_RECOGNITION` permission is granted, `useStepTracker` starts the `StepTrackerService`. The service:
- Registers `TYPE_STEP_COUNTER` with 0-latency delivery (real-time)
- Tracks daily total in `SharedPreferences`
- Detects day rollover and resets automatically
- Restarts on task removal (`onTaskRemoved` → `AlarmManager`)
- Restarts on boot (`BootReceiver`)
- Monitored by `StepTrackerWorker` (15-min watchdog)

## Step 3: JS Polling
`useStepTracker` polls `getTotalDailySteps()` every 2 seconds via `setInterval`. When the native total changes, it updates the store. On `AppState` change to `active`, it immediately polls and ensures the service is alive.

## Step 4: Hook to Store
`setTodaySteps(totalSteps)` is called on the fitness store, which:
1. Updates `todaySteps` in memory
2. Calls `syncTodayWithHistory()` to upsert today's entry in `stepHistory[]`
3. Triggers debounced widget refresh (2s)
4. Triggers debounced SQLite save (3s)

## Step 5: Store to SQLite
The debounced save reads the latest state from both stores, calculates calories/distance, and writes to the `daily_steps` table via `saveDailySteps()`.

## Step 6: Widget Data Source
The widget reads from the **native service directly** via `NativeModules.NfitBackgroundSteps.getTotalDailySteps()`. Falls back to zustand storage if native module is unavailable. No double-counting — single source of truth.

The native service triggers widget update broadcasts every 10 steps for real-time widget display even when the app is backgrounded.

## Step 7: Store to UI
Screens read from stores via selectors:
- Home: `useStepTracker()` + `useFitnessStats()` - reads todaySteps, calories, distance, goal
- History: `getWeekHistory()`, `getMonthHistory()`, `getYearHistory()` - reads stepHistory
- Analytics: `stepHistory` filtered by date range

## Workout Flow
```
Workout Wizard (workouts.tsx)
    → addWorkout({ type, duration, calories, notes })
userStore
    → workouts[] (in memory)
    → persisted to user-storage via zustandStorage
```

Workouts are stored in Zustand only (no SQLite table writes currently, despite the table existing).

## Key Invariants
- `todaySteps` always equals the native service's `daily_total_steps` value.
- There is only ONE step counter (native service). JS never counts independently.
- The native service uses hardware `TYPE_STEP_COUNTER` which has built-in shake/vibration rejection.
- `stepHistory[]` is updated synchronously on every `setTodaySteps` call.
- Widget reads native SharedPreferences directly — always in sync with the service.
- SQLite writes are debounced (3s) as a secondary persistence layer for history.
- Service survives: app swipe (AlarmManager restart), device reboot (BootReceiver), OEM battery kill (WorkManager watchdog).

## Background Survival Chain
```
StepTrackerService (foreground service)
    ↓ killed by OEM battery saver?
onTaskRemoved → AlarmManager restart (3s delay)
    ↓ still killed?
BootReceiver → restart on boot/app update
    ↓ still killed?
StepTrackerWorker (WorkManager, every 15 min) → restart service
```
