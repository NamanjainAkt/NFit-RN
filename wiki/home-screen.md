# Home Screen

> `app/(tabs)/index.tsx` | Main dashboard

## Purpose
Displays the user's daily step count in a circular progress ring, key stat cards (calories, distance, streak, floors, active minutes, goal %), and triggers confetti on goal achievement.

## Key Behavior
- **Step ring**: Animated SVG-like ring using `Animated.View` with opacity-based progress. Pulses when goal is reached (3 iterations).
- **Confetti**: Triggers `Confetti` component when `goalReached` transitions from false to true (tracked via `prevGoalRef`).
- **Notifications**: Requests permissions and schedules a daily reminder at 20:00 on mount.
- **Onboarding redirect**: If `hasCompletedOnboarding` is false, redirects to `/onboarding`.
- **Demo mode warning**: Shows yellow card when `isSimulated` is true (sensor unavailable).

## Stats Displayed
| Stat | Source | Color |
|------|--------|-------|
| Steps | `stats.todaySteps` | `c.text` / `c.success` (on goal) |
| Calories | `calculateCalories()` | `c.calories` |
| Distance | `calculateDistance()` | `c.distance` |
| Streak | `stepStreak` | `c.streak` |
| Floors | `todayFloors` | `c.floors` |
| Active min | `todayActiveMinutes` | `c.activeMinutes` |
| Goal % | `todaySteps/goal` | `c.accent` |

## Dependencies
- [[use-step-tracker]] — `todaySteps`, `isSimulated`, `pulseAnim`
- [[use-fitness-stats]] — derived stats
- [[confetti]] — celebration animation
- [[notifications]] — permission + scheduling
- [[theme]] — colors
