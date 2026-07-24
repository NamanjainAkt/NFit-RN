# Nfit Wiki Log

Append-only chronological record. Format: `## [YYYY-MM-DD] action | subject`

## [2026-07-24] refactor | Widget replaced with react-native-android-widget + accelerometer step detection

Complete rework of widget and step tracking architecture:
- Removed custom Kotlin Expo module (`modules/nfit-widget/`) 
- Replaced with `react-native-android-widget` library: widget UI as React
  components (`widget/NfitWidget.tsx`), task handler reads Zustand storage
  directly (`widget/widget-task-handler.tsx`)
- Java bridge: `android/.../widget/NfitWidget.java` extends `RNWidgetProvider`
- New `utils/stepDetector.ts` — accelerometer low-pass filter + adaptive
  threshold + peak detection (primary tracking mode at 20Hz)
- New `utils/stepFilter.ts` — cadence & burst filter (fallback for pedometer)
- New `utils/__tests__/stepFilter.test.ts` — tests for step filter
- `widgetBridge.ts` updated to use `requestWidgetUpdate()` instead of
  custom native module; added `resetAccumulatedSteps()`
- `useStepTracker.ts` — dual mode: accelerometer StepDetector when available,
  pedometer + stepFilter fallback
- `fitnessStore.ts` — debounced widget refresh + SQLite save; added
  `currentStreak` field, `syncTodayWithHistory` for calorie/distance sync
- Hourly notifications 8am-8pm retained from previous session
- Streak semantics: first goal reach = 1 (user's preference), gap reset = 1

## [2026-07-24] fix | Widget "Unable to load" crash & robust step cadence/shake filtering

1. Widget Fix:
   - Removed non-remotable `setColorStateList(pbarId, "setProgressTintList", ...)` call from `NfitWidgetProvider.kt` and `NfitWidgetModule.kt`. In Android RemoteViews, `setProgressTintList` is not annotated with `@Remotable`, which caused Android System Server to throw an ActionException during widget inflation and display "Unable to load widget".
   - Enhanced widget refresh trigger to issue broadcast intent `expo.modules.nfitwidget.REFRESH` and update all widget instances via `appWidgetManager.updateAppWidget(appWidgetIds, views)`.

2. Robust Step Cadence & Shake Filter:
   - Created `utils/stepFilter.ts` implementing a 4-point cadence & burst filter algorithm.
   - Enforces a 5-step minimum burst threshold within a 2500ms cadence window before committing steps, discarding single/double phone handling shakes.
   - Caps step rate to max 5 steps/second to block rapid manual phone shaking.
   - Fully integrated into `hooks/useStepTracker.ts` and covered by unit tests in `utils/__tests__/stepFilter.test.ts`.

## [2026-07-24] fix | Widget native module not linked into APK

Widget module at `modules/nfit-widget/` was never linked into the Android
build — not in `package.json` dependencies, so Expo autolinking skipped it.
`requireNativeModule('NfitWidget')` failed silently, widget bridge returned
false, SharedPreferences never written, widget always showed zeros.

Fix: added `"nfit-widget": "file:./modules/nfit-widget"` to root `package.json`
then ran `npm install` and rebuilt APK.

Build output confirms `nfit-widget (1.0.0)` now auto-linked.

## [2026-07-24] fix | Notifications spamming 8pm every hour daytime

Replaced single daily reminder at 20:00 (which stacked duplicates on every
mount, causing 8+ notifications at 8pm) with hourly reminders 8am-8pm.
Cancels all existing scheduled notifications before rescheduling.

Changes:
- `utils/notifications.ts` — `scheduleDailyReminder` → `scheduleHourlyReminders`
  cancels all, then schedules DAILY triggers for each hour 8..20
- `app/(tabs)/index.tsx` — updated import & call

## [2026-07-24] fix | Step tracking deadlock + streak semantics

Fixed step validation pipeline that blocked all steps (chicken-and-egg deadlock:
checkContinuousMovement required 15 accepted steps to contribute score, but
without it confidence never reached threshold 70).

Reverted pedometer callback to direct step counting (no validation gate).
Deleted dead code: stepValidator.ts, useMotionValidator.ts, activityBridge.ts.

Fixed streak: first goal reach and gap reset now set stepStreak to 0 (not 1),
so streak only counts consecutive days (2+ days = streak 1+).

Changes:
- `hooks/useStepTracker.ts` — removed validation pipeline from pedometer
  callback; removed dead imports/refs/activityPoll
- `store/userStore.ts` — stepStreak init 0, gap reset 0

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

## [2026-07-24] fix | Widget crash resilience

Added try-catch wrappers around both widget update paths and added null-ID guards in `NfitWidgetModule.triggerWidgetUpdate` to prevent unhandled exceptions from crashing the widget provider.
- `modules/nfit-widget/.../NfitWidgetModule.kt` — wrapped `triggerWidgetUpdate` in try-catch, replaced raw `setTextViewText(resId(...), ...)` with safe helpers that guard `resId == 0`
- `android/app/.../NfitWidgetProvider.kt` — wrapped `onUpdateInternal` in try-catch, added `android.util.Log` import

## [2026-07-24] build | Production APK (debug-signed)

Built release APK via `./gradlew :app:assembleRelease` with OpenJDK 17.
- Output: `android/app/build/outputs/apk/release/app-release.apk` (90 MB)
- Signed with debug keystore (not Play Store ready)
- Hermes JS engine enabled, universal APK (all 4 ABIs: arm64-v8a, armeabi-v7a, x86, x86_64)
- Version: 1.2.1 (versionCode 1)

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
# #   [ 2 0 2 6 - 0 7 - 2 4 ]   u p d a t e   |   u s e r S t o r e ,   u s e S t e p T r a c k e r ,   N f i t W i d g e t P r o v i d e r :   F i x e d   s t r e a k   l o g i c   t o   b e   1 - i n d e x e d ,   h i d   s t r e a k   b a d g e   i f   <   2 ,   t i g h t e n e d   s t e p F i l t e r   p a r a m e t e r s   a g a i n s t   s h a k i n g ,   a n d   f i x e d   w i d g e t   i n f l a t i o n   c r a s h   b y   r e p l a c i n g   t h e m e   a t t r i b u t e   w i t h   a b s o l u t e   s t y l e  
 ## [2026-07-24] update | Downgraded Expo SDK to 54 and aligned dependencies

## [2026-07-24] build | App production build release

Built production APK successfully using Expo SDK 54 after refactoring widget to react-native-android-widget and integrating useFitnessStats. Output generated at android/app/build/outputs/apk/release/app-release.apk
