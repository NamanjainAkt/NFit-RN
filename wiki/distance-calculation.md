# Distance Calculation

> Formula used for distance estimation from steps

## Formula
```typescript
const stride = height * 0.415;
const distance = useMetric
  ? steps * stride / 100000   // cm to km
  : steps * stride / 63360;   // inches to miles
```

## Characteristics
- **Height-based stride**: Uses 0.415 ratio (empirical average)
- **Unit-aware**: Converts appropriately based on metric/imperial preference
- **Reference**: A 170cm person has a stride of ~70.5cm, so 10,000 steps = ~7.05 km

## Where Used
- [[home-screen]] — via [[use-fitness-stats]]
- [[history-screen]] — weekly/monthly/yearly distance summaries
- [[fitness-store]] — `syncTodayWithHistory()` and `getYearHistory()`
- [[widget-bridge]] — widget distance display

## See Also
- [[calorie-calculation]] — companion formula
