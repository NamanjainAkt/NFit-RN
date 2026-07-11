# Calculations

> `utils/calculations.ts` | Fitness metric formulas

## Functions

### `calculateCalories(steps, weight, useMetric)`
```typescript
const weightKg = useMetric ? weight : weight * 0.453592;
return Math.round(steps * weightKg * 0.0005);
```
Weight-normalized calorie estimation. Converts lbs to kg when imperial.

### `calculateDistance(steps, height, useMetric)`
```typescript
const stride = height * 0.415;
return useMetric
  ? steps * stride / 100000   // cm -> km
  : steps * stride / 63360;   // inches -> miles
```
Uses a 0.415 stride-length-to-height ratio.

## Usage
- [[home-screen]] — via [[use-fitness-stats]]
- [[history-screen]] — weekly/monthly/yearly calorie summaries
- [[fitness-store]] — syncTodayWithHistory, getYearHistory
- [[widget-bridge]] — widget data calculation
