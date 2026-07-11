# Calorie Calculation

> Formula used for calorie estimation from steps

## Formula
```typescript
calories = Math.round(steps * weightKg * 0.0005)
```

Where `weightKg` is:
- Direct if `useMetric` is true
- `weight * 0.453592` if `useMetric` is false (lbs to kg)

## Characteristics
- **Linear**: Calories scale proportionally with both steps and weight
- **No MET table**: Uses a simple multiplier rather than metabolic equivalent of task
- **Weight-normalized**: Heavier users burn more calories for the same step count
- **Reference**: A 70kg person walking 10,000 steps burns ~350 kcal

## Where Used
- [[home-screen]] — via [[use-fitness-stats]]
- [[history-screen]] — weekly/monthly/yearly calorie summaries
- [[fitness-store]] — `syncTodayWithHistory()` and `getYearHistory()`
- [[widget-bridge]] — widget calorie display
- [[workouts-screen]] — workout calorie estimation uses a different formula: `duration * caloriesPerMin * (weightKg / 70)`

## See Also
- [[distance-calculation]] — companion formula
