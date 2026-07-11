# Analytics Screen

> `app/(tabs)/analytics.tsx` | Deep analytics and trends

## Purpose
Provides date-range-filtered analytics: goal progress ring, step trends bar chart, activity breakdown rings, week-over-week comparison, workout distribution, and activity calendar heatmap.

## Date Range Presets
- 7D, 30D (default), 90D, Custom (text input for start/end dates)

## Sections

### Stats Bar
Horizontal bar showing total steps, average, calories, distance for the selected range.

### Goal Progress
Large circular progress ring showing today's step count vs goal, plus floors/active minutes/calories.

### Step Trends
Bar chart of filtered step history. Labels shown every N bars depending on data density (1, 2, 5, or 14).

### Activity Breakdown
Three mini rings: Steps (% of goal), Floors (% of 10), Active Minutes (% of 60).

### Week Over Week
Side-by-side daily bar comparison (this week vs last week).

### Workout Distribution
Horizontal bar breakdown of workout types by duration, showing count and total minutes.

### Activity Calendar
Monthly heatmap with intensity-based coloring and a "Less -> More" legend.

## Dependencies
- [[user-store]] — `profile`, `workouts`
- [[fitness-store]] — `stepHistory`, `todaySteps`, `todayFloors`, `todayActiveMinutes`
- [[theme]] — colors
- `date-fns` — date range calculations
