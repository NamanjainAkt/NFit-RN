# Nfit Background Steps (Native Module)

> `modules/nfit-background-steps/` | Android background step tracking

## Purpose
Runs a foreground service to continuously track steps even when the app is backgrounded or killed.

## Architecture
- **BackgroundStepsModule.kt** — Expo module with `startService()`/`stopService()` methods
- **StepTrackerService.kt** — Foreground service using `Pedometer` sensor
- **StepTrackerWorker.kt** — WorkManager periodic task for persistent tracking
- **BootReceiver.kt** — BroadcastReceiver to restart service on device boot

## Permissions Used
- `FOREGROUND_SERVICE` — foreground service
- `FOREGROUND_SERVICE_HEALTH` — health data foreground service
- `RECEIVE_BOOT_COMPLETED` — auto-restart on boot
- `WAKE_LOCK` — prevent CPU sleep during tracking

## Configuration
- `expo-module.config.json` — module registration
- `android/build.gradle` — AAR build config

## Dependencies
- [[widget-bridge]] — JS-side bridge (`startBackgroundService`/`stopBackgroundService`)
- [[use-step-tracker]] — controls service start/stop
