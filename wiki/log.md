# Nfit Wiki Log

Append-only chronological record. Format: `## [YYYY-MM-DD] action | subject`

## [2026-07-11] fix | Streak only increments on goal reached + widget redesign

Fixed streak incorrectly incrementing on every step instead of only when
daily goal is reached. Redesigned Android widget with Material 3 aesthetic.

Changes:
- `store/userStore.ts` — `updateStepStreak` now takes `goalReached: boolean`
- `hooks/useStepTracker.ts` — removed streak calls from pedometer callback
  and simulation; added `updateStepStreak` to the goal-notification effect
- `modules/nfit-widget/` — redesigned layout with hero step count, fire streak
  badge, goal-reached badge, better typography, deeper background gradient,
  improved progress bar and metrics styling
- `android/app/.../NfitWidgetProvider.kt` — updated for new layout elements

## [2026-07-11] style | Refine widget to Pixel / Material 3 minimal aesthetic

Updated widget drawables and layout to match Pixel/NothingOS/Apple Health style:
- Background: subtle gradient #191C22→#15171C, 8% opacity border, no glow
- Badges: solid #232323 streak pill (18dp radius), transparent goal badge (no fill)
- Colors: muted Material accents (EF5350, 42A5F5, 66BB6A, AB47BC)
- Typography: hero 46sp, labels #7E848F / #8B9099 / #9AA0A6
- Divider: 30% opacity #2A2D36
- Progress tints: EF5350→FB8C00→FDD835→8BC34A→4CAF50
- Removed all gradients, glow, gaming aesthetic; flat + spacious

## [2026-07-11] fix | Step persistence on app restart

Fixed step counter resetting to 0 on app restart. Two root causes:
1. `useStepTracker` only fell back to Zustand `stepHistory` on SQL errors (catch), not when SQLite returned null (the `daily_steps` table is debounced at 3s, so data is often missing on quick restarts).
2. `_layout.tsx` only waited for `userStore` hydration; `fitnessStore` might not be rehydrated when the step tracker reads `stepHistory`.

Changes:
- `app/_layout.tsx` — wait for both stores to rehydrate before rendering
- `hooks/useStepTracker.ts` — move fallback to `stepHistory` into an `else` branch covering the null-result case

## [2026-07-19] fix | Missing useEffect import in onboarding.tsx

Fixed `onboarding.tsx` missing `useEffect` in React import — would crash at
runtime with `ReferenceError`.

Changes:
- `app/onboarding.tsx:1` — added `useEffect` to import

## [2026-07-19] fix | Widget layout conflict (redesign was silently discarded)

The host app's `nfit_widget.xml` was overriding the module's Material 3
redesigned layout at build time. Deleted host app copy; module layout now wins.
Also deleted dead stub `NfitWidgetProvider.kt` from module.

Changes:
- `android/app/src/main/res/layout/nfit_widget.xml` — DELETED
- `modules/nfit-widget/.../NfitWidgetProvider.kt` — DELETED (was dead stub)

## [2026-07-19] fix | .commit() blocks JS thread (NfitWidgetModule.kt)

Changed `.commit()` to `.apply()` on SharedPreferences write to avoid blocking
the native module (JS bridge) thread during disk I/O.

Changes:
- `modules/nfit-widget/.../NfitWidgetModule.kt:78` — `.commit()` → `.apply()`

## [2026-07-19] fix | Data race on accumulatedSteps (StepTrackerService.kt)

Added `@Volatile` annotation to `accumulatedSteps` field in the foreground
service to fix a data race between the sensor callback thread and the coroutine
IO thread. (File was later deleted in the hybrid refactor, but fix applied first.)

Changes:
- `modules/nfit-background-steps/.../StepTrackerService.kt:34` — `@Volatile`

## [2026-07-19] fix | BootReceiver startForegroundService crash on Android 12+

Wrapped `startForegroundService` in try/catch with WorkManager fallback.
(File was later deleted in the hybrid refactor, but fix applied first.)

Changes:
- `modules/nfit-background-steps/.../BootReceiver.kt:22-28` — try/catch

## [2026-07-19] fix | CSV export double-quote escaping

Added `.replace(/"/g, '""')` to notes field in CSV export to prevent malformed
output when workout notes contain double-quote characters.

Changes:
- `utils/export.ts:37` — escape `"` in CSV

## [2026-07-19] refactor | Hybrid background step tracking

Replaced foreground-service-based background tracking with a battery-efficient
hybrid model: WorkManager reads the hardware TYPE_STEP_COUNTER every 15 min
(app closed), JS Pedometer handles real-time increments (app open). Steps taken
while app was closed are recovered on next launch via WorkManager SharedPrefs.

Deleted:
- `modules/nfit-background-steps/.../StepTrackerService.kt` — DELETED (247 lines)
- `modules/nfit-background-steps/.../BootReceiver.kt` — DELETED (32 lines)

Changes:
- `BackgroundStepsModule.kt` — stripped 90→27 lines, only `getAccumulatedSteps()`
- `StepTrackerWorker.kt` — delta sanity limit 1000→5000 (was discarding valid steps)
- Module `AndroidManifest.xml` — stripped 25→1 line, no service/receiver decls
- App `AndroidManifest.xml` — removed 5 unused permissions (FOREGROUND_SERVICE,
  FOREGROUND_SERVICE_HEALTH, WAKE_LOCK, RECEIVE_BOOT_COMPLETED, BODY_SENSORS)
- `utils/widgetBridge.ts` — added `getAccumulatedSteps()`, removed bg service fns
- `hooks/useStepTracker.ts` — reads WorkManager baseline on startup, removed
  bg tracking UI (isBackgroundTracking, start/stopBackgroundTracking)
- Wiki: all affected pages updated (nfit-background-steps, data-flow, architecture,
  widget-bridge, use-step-tracker, index, log)

## [2026-07-11] ingest | Full codebase

Initial ingest of entire Nfit codebase. Created 24 wiki pages covering:
- 9 screens (root layout, onboarding, error boundary, 5 tabs, tabs layout)
- 2 stores (userStore, fitnessStore)
- 2 hooks (useStepTracker, useFitnessStats)
- 7 utils (calculations, database, storage, notifications, theme, export, widgetBridge)
- 2 native modules (nfit-widget, nfit-background-steps)
- 1 component (Confetti)
- 5 concept pages (architecture, data-flow, dual-storage, calorie-calculation, distance-calculation)
- 3 source doc pages (PLAN.md, package.json, app.json)

Updated project-level AGENTS.md with strict wiki-first workflow.
