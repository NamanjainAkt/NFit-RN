# useStepTracker

> `hooks/useStepTracker.ts` | Polls native StepTrackerService for real-time step count

## Purpose
Central hook that reads the daily step total from the native Android `StepTrackerService` via polling. The native service uses the hardware `TYPE_STEP_COUNTER` sensor (single source of truth) which runs continuously in the background and has built-in shake rejection. The JS layer never counts steps independently.

## Return Value
```typescript
{
  todaySteps: number;
  trackingUnavailable: boolean;
  progressAnim: Animated.Value;
  pulseAnim: Animated.Value;
  goal: number;
  goalReached: boolean;
}
```

## Key Behavior
1. **Restore baseline**: Loads today's steps from SQLite via `loadDailyStepsForDate()`. Falls back to Zustand `stepHistory` if SQLite returns null.
2. **Permission & service start**: Requests `ACTIVITY_RECOGNITION` via `Pedometer.requestPermissionsAsync()`, then starts `StepTrackerService` through [[widget-bridge]].
3. **Seed native total**: If SQLite baseline > native total (service was restarted mid-day), calls `setTotalDailySteps()` to seed the native counter.
4. **Battery optimization**: Checks `isBatteryOptimized()` and requests exemption via system dialog if needed.
5. **2-second polling**: Sets up `setInterval` that calls `getTotalDailySteps()` every 2s and updates the store when the count changes.
6. **App resume sync**: On `AppState` change to `active`, immediately polls native total and ensures the service is still running (restarts if killed).
7. **Widget sync**: Notifies widget on profile change and app resume.
8. **Goal reached**: When progress >= 1 and not yet notified: sends notification, updates streak, triggers pulse animation (3 loops), and sends streak notification at 7, 14, 21... consecutive days.

## Architecture
```
TYPE_STEP_COUNTER (hardware sensor)
    → StepTrackerService (foreground service, always running)
    → SharedPreferences (daily_total_steps)
    → getTotalDailySteps() polled every 2s by JS
    → setTodaySteps() → fitnessStore → widget + SQLite
```

## Tracking Unavailable Mode
When pedometer is unavailable or permission is denied: sets `trackingUnavailable` to true. The UI renders a warning banner instead of injecting fake random steps.

## Dependencies
- [[user-store]] - profile, stepStreak, updateStepStreak
- [[fitness-store]] - todaySteps, setTodaySteps, setTodayFloors, setTodayActiveMinutes
- [[database]] - loadDailyStepsForDate
- [[notifications]] - sendGoalReachedNotification, sendStreakNotification
- [[widget-bridge]] - refreshWidget, startBackgroundService, getTotalDailySteps, setTotalDailySteps, isBackgroundServiceRunning, requestBatteryOptimizationExemption, isBatteryOptimized
- `expo-sensors` - Pedometer (permission only, not for counting)
