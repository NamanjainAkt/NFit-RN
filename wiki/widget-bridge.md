# Widget Bridge

> `utils/widgetBridge.ts` | Native module bridge for widget + background service

## Purpose
Provides JS interface to the native Android modules for the home screen widget and background step tracking service.

## Functions

### `refreshWidget()`
Reads current state from stores, calculates calories/distance/streak, calls `updateWidgetData(data)` on the native module. Falls back to `updateWidget()` if data method unavailable. Android-only.

### `getWidgetData()`
Reads widget data from native storage. Android-only.

### `getAccumulatedSteps()`
Reads accumulated steps from WorkManager background tracking. Returns the total steps recorded while the app was closed. Delegates to `NfitBackgroundSteps.getAccumulatedSteps()`. Android-only; returns 0 on other platforms.

### `pushDataToWidget()`
Alias for `refreshWidget()`.

## Native Module Loading
Lazy-loaded via `requireNativeModule('NfitWidget')` with fallback to `NativeModulesProxy`. Same pattern for `NfitBackgroundSteps`.

## Dependencies
- [[user-store]] — profile, stepStreak
- [[fitness-store]] — todaySteps, todayFloors, todayActiveMinutes
- [[calculations]] — calculateCalories, calculateDistance
- [[nfit-widget]] — native module
- [[nfit-background-steps]] — native module
