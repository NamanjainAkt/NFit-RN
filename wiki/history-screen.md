# History Screen

> `app/(tabs)/history.tsx` | Historical step data visualization

## Purpose
Shows step history in week/month/year views with bar charts, calendar heatmaps, and summary stats.

## View Modes

### Week View
- 7-day bar chart (bar height = steps relative to max)
- Green bars for goal-met days
- Weekly summary: total steps, goal %, calories, distance, floors, active minutes, daily avg, days goal met, vs. last week delta

### Month View
- Calendar grid with color-coded dots (opacity = intensity)
- Green dots for goal-met days
- Monthly summary with same metrics + vs. last month delta

### Year View
- 12-month bar chart
- Monthly goal comparison
- Yearly summary with vs. last year delta

## Streak Display
Shows current step streak in a fire icon card at the top.

## Dependencies
- [[user-store]] — `profile`, `workouts`, `stepStreak`
- [[fitness-store]] — `stepHistory`, `getWeekHistory`, `getMonthHistory`, `getYearHistory`
- [[calculations]] — `calculateCalories`
- [[theme]] — colors
- `date-fns` — date manipulation (getDay, startOfMonth, endOfMonth, subDays, etc.)
