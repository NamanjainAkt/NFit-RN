# Export

> `utils/export.ts` | Data export to JSON/CSV

## Functions

### `exportToJSON(data)`
Returns pretty-printed JSON string of `ExportData`.

### `exportToCSV(stepHistory)`
Returns CSV string with headers: `Date,Steps,Floors,Active Minutes,Calories,Distance`.

### `exportWorkoutsToCSV(workouts)`
Returns CSV string with headers: `Date,Type,Duration (min),Calories,Notes`.

### `shareData(data, format)`
1. Serializes data to JSON or CSV
2. Writes to `FileSystem.cacheDirectory`
3. Opens system share sheet via `expo-sharing`

## ExportData Shape
```typescript
{ profile: {...}, stepHistory: DailySteps[], workouts: Workout[], exportedAt: string }
```

## Dependencies
- `expo-file-system` — file write
- `expo-sharing` — share sheet
