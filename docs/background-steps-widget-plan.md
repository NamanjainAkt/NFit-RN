# Background Step Tracking & Real-Time Widget Integration Plan

## Goal
Ensure Nfit continuously tracks steps in the background even when the app is closed or screen is off, and ensure the Android widget opens the app when clicked and displays real-time step counts with minimal delay.

## Architecture Decisions
1. **Android Foreground Service (`StepTrackerService.kt`)**:
   - Uses hardware `TYPE_STEP_COUNTER` sensor.
   - Shows an ongoing notification displaying current step count (e.g. "Nfit Step Tracker: 4,520 steps").
   - Continously receives step count updates even when screen is off or app is closed.
   - Batches widget updates every 20 steps or 30 seconds to balance realtime widget updates with battery efficiency.

2. **BootReceiver (`BootReceiver.kt`)**:
   - Listens for `ACTION_BOOT_COMPLETED` to automatically restart step tracking on phone reboot.

3. **Widget Click Navigation (`NfitWidget.tsx`)**:
   - Adds `clickAction="OPEN_APP"` on the root `FlexWidget` in `NfitWidget.tsx`.
   - Clicking the widget opens the main Nfit app directly to the Home tab.

4. **Native Module Exposure (`BackgroundStepsModule.kt`)**:
   - Exposes `startService()`, `stopService()`, `isServiceRunning()`, `getAccumulatedSteps()`, `resetAccumulatedSteps()`, and `updateWidgetSteps(steps, goal)`.

5. **JS Layer (`widgetBridge.ts` & `useStepTracker.ts`)**:
   - Automatically starts the foreground service on app launch.
   - Syncs baseline steps between JS store and native SharedPreferences.
   - Consumes background step deltas seamlessly.

## Implementation Steps
- [ ] Update `modules/nfit-background-steps/android/src/main/AndroidManifest.xml` with permissions and service declarations.
- [ ] Create `StepTrackerService.kt` for continuous background step tracking and notification management.
- [ ] Create `BootReceiver.kt` to auto-restart service after boot.
- [ ] Update `BackgroundStepsModule.kt` to expose background service lifecycle and step sync methods to React Native.
- [ ] Update `widget/NfitWidget.tsx` with `clickAction="OPEN_APP"`.
- [ ] Update `utils/widgetBridge.ts` to bridge start/stop background tracking and widget updates.
- [ ] Update `hooks/useStepTracker.ts` to integrate background tracking lifecycle.
- [ ] Test build via `./gradlew :app:assembleRelease` to verify compilation.
- [ ] Update Wiki pages (`wiki/nfit-background-steps.md`, `wiki/nfit-widget.md`, `wiki/use-step-tracker.md`, `wiki/widget-bridge.md`, `wiki/index.md`, `wiki/log.md`).
