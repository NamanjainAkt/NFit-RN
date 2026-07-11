# useFitnessStats

> `hooks/useFitnessStats.ts` | Derived fitness statistics

## Purpose
Combines user profile data with today's step data to compute derived stats for the home screen.

## Return Value
```typescript
{
  profile: UserProfile;
  todaySteps: number;
  todayFloors: number;
  todayActiveMinutes: number;
  stepStreak: number;
  calories: number;      // calculateCalories(steps, weight, useMetric)
  distance: number;      // calculateDistance(steps, height, useMetric)
  distanceUnit: string;  // "km" or "mi"
  goal: number;          // dailyStepGoal || 10000
  goalReached: boolean;  // todaySteps >= goal
}
```

## Dependencies
- [[user-store]] — profile, stepStreak
- [[fitness-store]] — todaySteps, todayFloors, todayActiveMinutes
- [[calculations]] — calculateCalories, calculateDistance
