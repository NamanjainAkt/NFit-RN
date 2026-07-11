# Widget Bridge

> `utils/widgetBridge.ts` | Native module bridge for widget + background service

## Purpose
Provides JS interface to the native Android modules for the home screen widget and background step tracking service.

## Functions

### `refreshWidget()`
Reads current state from stores, calculates calories/distance/streak, calls `updateWidgetData(data)` on the native module. Falls back to `updateWidget()` if data method unavailable. Android-only.

### `getWidgetData()`
Reads widget data from native storage. Android-only.

### `startBackgroundService()` / `stopBackgroundService()`
Controls the foreground service for background step tracking. Delegates to `NfitBackgroundSteps.startService()`/`stopService()`.

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
