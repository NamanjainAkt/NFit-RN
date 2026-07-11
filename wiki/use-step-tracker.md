# useStepTracker

> `hooks/useStepTracker.ts` | Pedometer integration and step tracking hook

## Purpose
Central hook that manages step counting: restores baseline from SQLite, subscribes to the pedometer sensor, syncs to the widget, and manages goal notifications + animations.

## Return Value
```typescript
{
  todaySteps: number;
  isSimulated: boolean;
  progressAnim: Animated.Value;
  pulseAnim: Animated.Value;
  goal: number;
  goalReached: boolean;
  isBackgroundTracking: boolean;
  startBackgroundTracking: () => Promise<void>;
  stopBackgroundTracking: () => Promise<void>;
}
```

## Flow
1. **Restore baseline**: Loads today's steps from SQLite via `loadDailyStepsForDate()`. Falls back to Zustand `stepHistory` if SQLite returns null (debounced save hadn't fired) or throws.
2. **Start pedometer**: Checks `Pedometer.isAvailableAsync()`, requests permissions, subscribes via `watchStepCount()`.
3. **Step accumulation**: `data.steps` (since subscription) is added to the restored baseline. Prevents losing steps on app restart.
4. **Widget sync**: Notifies widget every 50 steps via `refreshWidget()`.
5. **Streak update**: Calls `updateStepStreak()` on any step activity.
6. **Goal reached**: When progress >= 1 and not yet notified: sends notification, triggers pulse animation (3 loops), sends streak notification if streak % 7 == 0.

## Simulation
When pedometer is unavailable or permission denied: generates random steps (1000-6000), floors (steps/200), active minutes (steps/100).

## Dependencies
- [[user-store]] — profile, stepStreak, updateStepStreak
- [[fitness-store]] — todaySteps, setTodaySteps, setTodayFloors, setTodayActiveMinutes
- [[database]] — loadDailyStepsForDate, saveStepCounterState
- [[notifications]] — sendGoalReachedNotification, sendStreakNotification
- [[widget-bridge]] — refreshWidget, startBackgroundService, stopBackgroundService
- `expo-sensors` — Pedometer
