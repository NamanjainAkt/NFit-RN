# User Store

> `store/userStore.ts` | Zustand store for user profile and app state

## State Shape
```typescript
interface UserState {
  profile: UserProfile | null;
  hasCompletedOnboarding: boolean;
  stepStreak: number;
  lastActiveDate: string | null;        // ISO date string
  workouts: Workout[];
  workoutGoals: WorkoutGoal[];
}
```

## Key Types
```typescript
interface UserProfile {
  name: string; weight: number; height: number; age: number;
  dailyStepGoal: number; dailyCalorieGoal: number;
  weightGoal: number; weeklyWorkoutGoal: number;
  useMetric: boolean; darkMode: boolean;
}
interface Workout {
  id: string; type: string; duration: number;
  calories: number; date: string; notes?: string;
}
```

## Actions
| Action | Behavior |
|--------|----------|
| `setProfile(p)` | Sets profile + marks onboarding complete |
| `setHasCompletedOnboarding(v)` | Direct flag toggle |
| `updateStepStreak(today, goalReached)` | Only increments if `goalReached` is true. First-ever goal → sets streak to 1. Consecutive with yesterday → increments. Gap → resets to 1. Uses date-fns `isSameDay` |
| `updateProfile(updates)` | Partial merge into profile |
| `addWorkout(w)` | Appends workout with auto-generated `id` (Date.now) and `date` (today) |
| `removeWorkout(id)` | Filters workout by id |
| `getWorkoutsForWeek()` | Returns workouts from last 7 days |

## Persistence
- Key: `user-storage`
- Storage: [[storage]] (SQLite primary, AsyncStorage fallback)
- Middleware: `zustand/persist` with `createJSONStorage`

## Dependencies
- [[storage]] — `zustandStorage`
- `date-fns` — streak calculation (`subDays`, `isSameDay`, `parseISO`)
