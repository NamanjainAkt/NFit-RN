# Settings Screen

> `app/(tabs)/settings.tsx` | Profile, goals, preferences, data management

## Purpose
Allows editing all user profile fields, toggling preferences, exporting data, and resetting the app.

## Sections

### Profile
Editable fields: Name, Weight, Height, Age. Each updates via `updateProfile()`.

### Goals
Editable fields: Daily Steps, Daily Calories, Weight Goal, Weekly Workouts.

### Preferences
- Dark Mode toggle (Switch)
- Use Metric Units toggle (Switch)

### Data
- Export Data: JSON or CSV format via `shareData()`
- Reset All Data: Redirects to onboarding, clears state

### Background Service
Info text + link to battery settings (Android only).

## Dependencies
- [[user-store]] — `profile`, `updateProfile`, `workouts`, `setHasCompletedOnboarding`
- [[fitness-store]] — `stepHistory`
- [[export]] — `shareData()`
- [[theme]] — colors
