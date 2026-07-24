# Widget Bridge

> `utils/widgetBridge.ts` | Widget update + background step bridge

## Purpose
Provides JS interface for the Android home screen widget (via `react-native-android-widget`) and the native background step tracking module.

## Functions

### `refreshWidget()`
Triggers a widget update via `requestWidgetUpdate()` from `react-native-android-widget`. Calls the [[widget-task-handler]] which reads Zustand storage and renders the widget React component. Android-only.

### `getWidgetData()`
Legacy — reads widget data from the old NfitWidget native module (kept for backward compatibility).

### `getAccumulatedSteps()`
Reads accumulated steps from WorkManager background tracking via `NfitBackgroundSteps.getAccumulatedSteps()`. Returns the total steps recorded while the app was closed. Android-only; returns 0 on other platforms.

### `resetAccumulatedSteps()`
Resets the native background step counter to 0 after syncing into the app's baseline.

### `pushDataToWidget()`
Alias for `refreshWidget()`.

## Dependencies
- [[widget-task-handler]] — renders the widget React component
- [[user-store]] — profile, stepStreak
- [[fitness-store]] — todaySteps, todayFloors, todayActiveMinutes
- [[nfit-background-steps]] — native background steps module
