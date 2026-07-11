# Workouts Screen

> `app/(tabs)/workouts.tsx` | Workout logging wizard + list

## Purpose
Lets users log workouts via a 3-step wizard (choose type, set duration, review & save) and displays a list of recent workouts.

## Workout Types
| ID | Name | Calories/min |
|----|------|-------------|
| running | Running | 10 |
| walking | Walking | 4 |
| cycling | Cycling | 8 |
| swimming | Swimming | 9 |
| weights | Weight Training | 6 |
| yoga | Yoga | 3 |
| hiking | Hiking | 7 |
| sports | Sports | 8 |

## Wizard Flow
1. **Type selection**: 2-column grid of workout types with icons
2. **Duration**: Preset chips (15/30/45/60 min) + custom input with +/-5 stepper
3. **Review**: Summary card (type, duration, est. calories, date) + optional notes

## Calorie Formula
`duration * caloriesPerMin * (weightKg / 70)` — weight-normalized to a 70kg reference.

## Weekly Stats Card
Shows total calories and total duration for the current week (last 7 days).

## Dependencies
- [[user-store]] — `workouts`, `addWorkout`, `removeWorkout`, `getWorkoutsForWeek`
- [[theme]] — colors
- `date-fns` — `format()` for date display
