# Nfit Background Steps (Native Module)

> `modules/nfit-background-steps/` | Android background step tracking via Foreground Service

## Purpose
Tracks steps continuously when the app is closed or when the screen is off by running an Android Foreground Service with hardware `TYPE_STEP_COUNTER` listener. Guarantees 100% reliable step counting and real-time widget updates.

## Architecture
- **StepTrackerService.kt** — Foreground Service registered under `foregroundServiceType="health"`. Displays an ongoing status bar notification showing live step updates.
- **BootReceiver.kt** — Receives `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED` intents to automatically relaunch `StepTrackerService` on device startup.
- **BackgroundStepsModule.kt** — Native Expo module exposing control and data methods to JS (`startService`, `stopService`, `isServiceRunning`, `getAccumulatedSteps`, `resetAccumulatedSteps`).

## How It Works
```
App launch / Boot → Starts StepTrackerService (Foreground Service)
                 → Service registers Sensor.TYPE_STEP_COUNTER listener
                 → Listens for hardware step events even when screen is off
                 → Handles day rollover logic independently of user activity
                 → Computes step deltas and updates SharedPreferences (nfit_background_steps)
                 → Broadcasts to Android widget every 10 steps
                 → JS polls getTotalDailySteps() every 2s while active
```

## Exposed Native Functions
- `startService()` — Starts the foreground service
- `stopService()` — Stops the foreground service
- `isServiceRunning()` — Checks if foreground service is running via SharedPreferences alive key
- `getTotalDailySteps()` — Returns total steps for today (Single Source of Truth)
- `setTotalDailySteps()` — Seeds native counter with steps (e.g. from SQLite history)
- `getDailyStepsDate()` — Returns the current tracking date string from native storage
- `resetSensorBaseline()` — Clears last sensor reading to force a re-baseline
- `isBatteryOptimized()` — Checks if battery optimization is enabled
- `requestBatteryOptimizationExemption()` — Prompts user to disable battery optimization

## Dependencies
- [[widget-bridge]] — JS-side bridge (`startBackgroundService`, `getAccumulatedSteps`)
- [[use-step-tracker]] — Starts background service and consumes step deltas on app launch
