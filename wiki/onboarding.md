# Onboarding Screen

> `app/onboarding.tsx` | Two-step onboarding flow

## Purpose
Collects user profile data (name, weight, height, age, daily step goal, unit preference) and requests Android permissions (activity recognition, notifications, battery optimization).

## Flow
1. **Step 0** — Profile form: name, weight, height, age, step goal, metric/imperial toggle
2. **Step 1** — Permission cards explaining notifications, physical activity, battery optimization. Link to system battery settings.

## Key Details
- Validates inputs: weight (1-500), height (1-300), age (1-150)
- Saves profile with defaults: `dailyCalorieGoal: 500`, `weightGoal: currentWeight`, `weeklyWorkoutGoal: 3`
- Requests `ACTIVITY_RECOGNITION` (Android 10+) and notification permissions (Android 13+)
- Redirects to `/(tabs)` if `hasCompletedOnboarding` is already true

## Dependencies
- [[user-store]] — `setProfile`, `hasCompletedOnboarding`
- [[theme]] — `getColors()`
- `expo-notifications` — permission requests
