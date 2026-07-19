# Nfit Background Steps (Native Module)

> `modules/nfit-background-steps/` | Android background step tracking via WorkManager

## Purpose
Tracks steps when the app is closed by reading the hardware `TYPE_STEP_COUNTER` sensor periodically via WorkManager. The accumulated total is exposed to JS on app start so steps taken while closed are never lost.

## Architecture (Hybrid)
- **BackgroundTracking** — WorkManager periodic task every 15 min reads the sensor, computes delta, saves to SharedPrefs
- **BackgroundStepsModule.kt** — Minimal Expo module exposing `getAccumulatedSteps()` to JS

No foreground service. No wakelock. No persistent notification.

## How It Works
```
App closed → WorkManager wakes every 15 min (200ms CPU)
           → Reads TYPE_STEP_COUNTER (hardware, monotonic)
           → Computes delta from last known total
           → Adds delta to accumulated steps
           → Saves to SharedPrefs (nfit_background_steps)
           → CPU sleeps

App opens  → JS calls native getAccumulatedSteps()
           → Uses result as baseline + pedometer incremental
           → Steps taken while closed are fully recovered
```

## Dependencies
- [[widget-bridge]] — JS-side bridge (`getAccumulatedSteps`)
- [[use-step-tracker]] — reads accumulated steps on startup
- `androidx.work:work-runtime-ktx` — WorkManager
