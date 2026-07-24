# useStepTracker

> `hooks/useStepTracker.ts` | Dual-mode step tracking (accelerometer + pedometer fallback)

## Purpose
Central hook that manages step counting: restores baseline from SQLite, subscribes to either the accelerometer-based StepDetector or the system pedometer, syncs to the widget, and manages goal notifications + animations.

## Return Value
```typescript
{
  todaySteps: number;
  isSimulated: boolean;
  progressAnim: Animated.Value;
  pulseAnim: Animated.Value;
  goal: number;
  goalReached: boolean;
}
```

## Flow
1. **Restore baseline**: Loads today's steps from SQLite via `loadDailyStepsForDate()`. Falls back to Zustand `stepHistory` if SQLite returns null.
2. **WorkManager baseline**: Calls `getAccumulatedSteps()`, adds to baseline, then calls `resetAccumulatedSteps()` to clear the native counter.
3. **Mode selection**: Checks `Accelerometer.isAvailableAsync()`:
   - **Primary (accelerometer)**: Creates a `StepDetector` ([[step-detector]]) at 50ms update interval (20Hz). Feeds raw accelerometer samples (converted to m/s²) via `detector.addSample()`. Counts step deltas via callback.
   - **Fallback (pedometer)**: Uses `Pedometer.watchStepCount()` with [[step-filter]] (processStepDelta) for cadence/burst filtering.
4. **Widget sync**: Notifies widget every 50 steps via `refreshWidget()`.
5. **Streak update**: Calls `updateStepStreak()` with `goalReached=true` inside the goal notification effect — only when daily goal is first met.
6. **Goal reached**: When progress >= 1 and not yet notified: sends notification, updates streak, triggers pulse animation (3 loops), sends streak notification at 7, 14, 21... consecutive days (`(stepStreak + 1) % 7 === 0`).

## Simulation
When pedometer is unavailable or permission denied: generates random steps (1000-6000).

## Dependencies
- [[user-store]] — profile, stepStreak, updateStepStreak
- [[fitness-store]] — todaySteps, setTodaySteps, setTodayFloors, setTodayActiveMinutes
- [[step-detector]] — accelerometer-based step detection
- [[step-filter]] — pedometer cadence/burst filter fallback
- [[database]] — loadDailyStepsForDate, saveStepCounterState
- [[notifications]] — sendGoalReachedNotification, sendStreakNotification
- [[widget-bridge]] — refreshWidget, getAccumulatedSteps, resetAccumulatedSteps
- `expo-sensors` — Pedometer, Accelerometer
