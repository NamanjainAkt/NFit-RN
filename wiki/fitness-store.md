# Fitness Store

> `store/fitnessStore.ts` | Zustand store for step tracking data

## State Shape
```typescript
interface FitnessState {
  todaySteps: number;
  todayFloors: number;
  todayActiveMinutes: number;
  stepHistory: DailySteps[];
  currentStreak: number;
}
interface DailySteps {
  date: string; steps: number; floors: number;
  activeMinutes: number; calories: number; distance: number;
}
```

## Key Behavior

### setTodaySteps(steps)
1. Updates `todaySteps`
2. Calls `syncTodayWithHistory()` — upserts today's entry in `stepHistory`
3. Triggers debounced widget refresh (2s delay)
4. Triggers debounced SQLite save (3s delay)

### History Queries
- `getWeekHistory()` — last 7 days, fills gaps with zero-data
- `getMonthHistory()` — all days in current month, fills gaps
- `getYearHistory()` — monthly aggregates up to current month

### Sync Strategy
- `syncTodayWithHistory()` calculates calories/distance from profile and calls `recordDay()`
- `recordDay()` upserts into `stepHistory[]` by date

## Persistence
- Key: `fitness-storage`
- Storage: [[storage]] (SQLite primary, AsyncStorage fallback)
- Also writes to SQLite `daily_steps` table via [[database]] (debounced 3s)

## Dependencies
- [[user-store]] — profile (for calorie/distance calculation)
- [[database]] — `saveDailySteps()`
- [[widget-bridge]] — `refreshWidget()` (debounced)
- [[calculations]] — `calculateCalories`, `calculateDistance`
