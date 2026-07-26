by claude 

Solid foundation — hardware `TYPE_STEP_COUNTER` + foreground service + "native is single source of truth" is the right call, and the reboot-detection logic in `onSensorChanged` is handled correctly. But there are a few real bugs that will hurt exactly the two things you're optimizing for (precision + always-on background counting), plus some battery/reliability landmines. Ordered by severity:

## 🔴 Critical

**1. Fake random step data as a fallback — `hooks/useStepTracker.ts`, `simulateSteps()`**
```ts
const simulateSteps = () => {
  setIsSimulated(true);
  const simulatedSteps = Math.floor(Math.random() * 5000) + 1000;
  setTodaySteps(simulatedSteps);
  ...
};
```
This fires whenever the pedometer is unavailable, permission is denied, or `setup()` throws — i.e. exactly the moments where you most need to *not* show fabricated data. It writes fake numbers into the real store, which then trigger goal-reached confetti and streak notifications off of numbers that never happened. For "precise and accurate," this needs to go entirely.

**Fix:** replace with a `trackingUnavailable` state that the UI can render as a proper CTA ("permission needed" / "sensor unsupported"), and leave `todaySteps` at the last real value from SQLite (or 0), never `Math.random()`.

**2. Day rollover only happens when a sensor event fires — `StepTrackerService.kt`, `onSensorChanged()` + `BackgroundStepsModule.kt`, `getTotalDailySteps`**

The rollover check:
```kotlin
val storedDate = prefs.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
if (storedDate != today) { /* reset to 0 */ }
```
only runs inside `onSensorChanged`. If the phone is stationary at midnight (charging overnight, sitting on a desk), no sensor event fires, so `KEY_DAILY_TOTAL_STEPS` still holds yesterday's total. `getTotalDailySteps()` in the module reads that stale value directly with no date check:
```kotlin
AsyncFunction("getTotalDailySteps") {
  prefs?.getInt(KEY_DAILY_TOTAL_STEPS, 0) ?: 0
}
```
Result: on the new day, before the user takes a single step, `useStepTracker` polls this, gets yesterday's total (e.g. 8500), and `syncTodayWithHistory()` writes **8500 into today's `stepHistory` entry** (since `format(new Date())` is already the new day). It self-corrects once the user actually walks and the sensor-side reset fires, but until then you have silently corrupted stats and a wrong home screen number.

**Fix:** make rollover a read-time check, not just a write-time one:
```kotlin
// BackgroundStepsModule.kt
private fun currentDailyTotal(): Int {
  val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
  val storedDate = prefs?.getString(StepTrackerService.KEY_DAILY_STEPS_DATE, "") ?: ""
  if (storedDate != today) {
    prefs?.edit()
      ?.putInt(StepTrackerService.KEY_DAILY_TOTAL_STEPS, 0)
      ?.putString(StepTrackerService.KEY_DAILY_STEPS_DATE, today)
      ?.apply()
    return 0
  }
  return prefs?.getInt(StepTrackerService.KEY_DAILY_TOTAL_STEPS, 0) ?: 0
}

AsyncFunction("getTotalDailySteps") { currentDailyTotal() }
```

**3. Permanent, untimed `PARTIAL_WAKE_LOCK` — `StepTrackerService.kt`, `acquireWakeLock()`**
```kotlin
wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nfit:step_tracking").apply { acquire() }
```
No timeout, held for the entire service lifetime. This is unnecessary — `TYPE_STEP_COUNTER` is delivered off a low-power co-processor and Android will wake the CPU just long enough to deliver each batch; you don't need to hold the CPU awake continuously. Holding an indefinite wake lock is one of the most common reasons OEM battery managers (MIUI, ColorOS, One UI, etc.) flag and kill "background" services — it shows up in battery stats as an abnormal wakelock, which is the opposite of what you want given you're already fighting OEM battery killers with the watchdog + exemption request.

**Fix:** remove it. If you're worried about doze delaying delivery, that's what `maxReportLatencyUs = 0` in your `registerListener` call already handles.

**4. No real iOS implementation — `utils/widgetBridge.ts`**

Every function is gated `if (Platform.OS !== 'android') return 0 / false;`. There's no `Pedometer.watchStepCount()` or `Pedometer.getStepCountAsync()` path for iOS anywhere in `useStepTracker.ts`. Given `app.json` configures `NSMotionUsageDescription` and full iOS support, this means on iOS: permission is requested and granted, `getTotalDailySteps()` always returns `0`, and the user is stuck at 0 steps forever (no fallback to `simulateSteps` since permission succeeds). iOS users get either nothing or, once you fix #1, an empty tracker.

**Fix:** iOS doesn't need (or allow) a custom foreground service — Core Motion's `CMPedometer` already tracks steps continuously regardless of app state. Add an iOS branch using `Pedometer.getStepCountAsync(startOfToday, now)` polled on app-foreground/interval, no native module needed.

## 🟠 High

**5. `POST_NOTIFICATIONS` never requested at runtime — `useStepTracker.ts`, setup permission flow**

Only `Pedometer.requestPermissionsAsync()` is called (motion permission). On Android 13+, if `POST_NOTIFICATIONS` isn't separately requested, your foreground-service notification silently won't show — bad for user trust and makes the "why is this using battery" story worse when OEM battery managers surface it. Add an explicit `Notifications.requestPermissionsAsync()` call before `startBackgroundService()`.

**6. Inexact alarm for restart-on-swipe — `StepTrackerService.kt`, `onTaskRemoved()`**
```kotlin
alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 3000, pendingIntent)
```
`set()` is treated as inexact and can be deferred by the OS/doze, especially right after the user just background-killed the app (a moment when the OS is already inclined to deprioritize you). Use `alarmManager.setExactAndAllowWhileIdle(...)` for a much more reliable near-immediate restart.

**7. `isServiceRunning` relies on deprecated `ActivityManager.getRunningServices` — `BackgroundStepsModule.kt`**

Works, but fragile and unnecessary. Track a `companion object @Volatile var isRunning = false`, set it `true` in `StepTrackerService.onCreate()` and `false` in `onDestroy()`, and read that from the module — cheaper and not deprecated.

## 🟡 Medium / polish

- **Battery-optimization dialog re-prompts every launch** (`useStepTracker.ts` step 5) — if the user dismisses it, you'll ask again next launch. Persist a "user declined" flag and stop nagging, maybe surface a settings-screen link instead.
- **Debounced SQLite save** (`fitnessStore.ts`, `debouncedDbSave`, 3s) — low risk since native SharedPreferences remains ground truth on next launch, but worth knowing: a crash mid-walk loses up to 3s of *history* persistence (not the live count).
- **Circular-dependency workaround via `require()`** (`fitnessStore.ts`, `debouncedWidgetRefresh`) — works but is a smell; consider an event emitter or lazy singleton instead.

## Not in this bundle, worth double-checking
- `BootReceiver.kt` isn't included — confirm it correctly restarts the foreground service from a `BOOT_COMPLETED` context (this is one of the officially exempted cases for starting foreground services from the background, but the implementation still needs to call `ContextCompat.startForegroundService`, not `startService`).
- `FOREGROUND_SERVICE_HEALTH` requires a declared-use justification in Play Console at submission — not a code fix, but will block release if skipped.

If you want, I can draft the concrete patches for #1–#4 (the ones that actually break accuracy/background reliability) as a diff you can drop in.

Good additions — these confirm one gap from before and surface a few new real issues. Here's the delta.

## 🔴 Confirms earlier finding

**`modules/nfit-background-steps/expo-module.config.json`**
```json
"platforms": ["android"],
```
This makes it explicit: the native module doesn't even compile for iOS. Combined with `widgetBridge.ts`'s `if (Platform.OS !== 'android') return 0` everywhere, iOS truly has **no step counting path at all** right now — not degraded, just absent. Confirms issue #4 from before; still needs a `CMPedometer`-based iOS branch.

## ✅ Verified correct

**`BootReceiver.kt`** — this is solid. `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED` are both in Android's exemption list for starting foreground services from background context, and `StepTrackerService.startService()` correctly branches to `startForegroundService()` on O+. No bug here.

One minor robustness add, given you're already fighting OEM battery killers (Xiaomi/MIUI etc. per the earlier review): some OEMs historically skip standard `BOOT_COMPLETED` and only send a vendor variant.

```xml
<!-- AndroidManifest.xml, inside the BootReceiver's intent-filter -->
<action android:name="android.intent.action.QUICKBOOT_POWERON" />
<action android:name="com.htc.intent.action.QUICKBOOT_POWERON" />
```
```kotlin
// BootReceiver.kt — onReceive
if (Intent.ACTION_BOOT_COMPLETED == action ||
    Intent.ACTION_MY_PACKAGE_REPLACED == action ||
    action == "android.intent.action.QUICKBOOT_POWERON") {
```
Nice-to-have, not critical.

## 🟠 New: real bugs

**1. `utils/notifications.ts` — notifications never use the channels you create**

You build three channels with different importance (`default`, `reminders`, `achievements`), but every actual send omits `channelId`:

```ts
// sendGoalReachedNotification — no channelId
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Goal Achieved!',
    body: `...`,
    data: { type: 'goal_reached' },
  },
  trigger: null,
});
```
On Android O+, an unspecified channel falls back to a default one with default importance — your `achievements` (DEFAULT) and `reminders` (HIGH) channels are dead weight, and users can't independently mute/configure reminder vs. achievement notifications in system settings, which is presumably the point of having separate channels.

**Fix — `sendGoalReachedNotification` and `sendStreakNotification`:**
```ts
content: {
  title: 'Goal Achieved!',
  body: `Congratulations! You've reached ${steps.toLocaleString()} steps today!`,
  data: { type: 'goal_reached' },
  ...(Platform.OS === 'android' ? { channelId: 'achievements' } : {}),
},
```
Same pattern for streak (`channelId: 'achievements'`) and inside `scheduleHourlyReminders`'s loop (`channelId: 'reminders'`).

**2. `requestNotificationPermissions()` is defined but never called anywhere in the provided flow**

Looking back at `useStepTracker.ts`'s `setup()`, only `Pedometer.requestPermissionsAsync()` runs (motion permission). `requestNotificationPermissions()` from `notifications.ts` — which also creates your channels — is orphaned. On Android 13+, `POST_NOTIFICATIONS` is a runtime permission that gates **all** notifications, including your foreground-service notification. If it's never requested, the notification may not show, which undermines the "visible foreground service = user trusts why battery is being used" story, and also means your channels never get created since channel creation lives inside that same function.

**Fix — `hooks/useStepTracker.ts`, inside `setup()`, before step 4 (`startBackgroundService`):**
```ts
import { requestNotificationPermissions } from '../utils/notifications';
// ...
// 3.5 Request notification permission + create channels (Android 13+ needs this
//     for the foreground-service notification to actually display)
await requestNotificationPermissions();

// 4. Start the native background service
try {
  await startBackgroundService();
} ...
```

**3. Minor: dead `logError` in `notifications.ts`**
```ts
const logError = __DEV__ ? console.error : () => {};
```
Defined, never referenced — every `catch {}` block in the file is silent even in dev, so failures here are currently invisible during development too. Either wire it into the catches (`catch (e) { logError(e); }`) or delete it.

## 🟡 Cleanup: dead schema in `utils/database.ts`

`step_counter_state` (table + `loadStepCounterState`/`saveStepCounterState`) is created and seeded on init but isn't called from anywhere in `fitnessStore.ts` or `useStepTracker.ts` — the app already gets its baseline from `daily_steps` via `loadDailyStepsForDate`. This looks like leftover schema from before you moved to "native service = single source of truth." Based on what's been shared, it's unused; worth confirming there's no other call site, then removing it to avoid a future maintainer trusting a table that's silently stale.

---

Net: the architecture is still right (hardware counter, foreground service, watchdog, boot receiver — all sound). The gaps are: iOS is a no-op, fake data on failure (from the last review), day-rollover on read (from the last review), and now the notification-channel wiring and unused dead schema. Want me to bundle all the confirmed fixes across both reviews into one patch set?




by deepseek

The architecture is **solid for production**, especially the choice of a native foreground service using `TYPE_STEP_COUNTER` (hardware‑based, shake‑resistant) as the single source of truth. The WorkManager watchdog, boot receiver, wake lock, and battery‑optimisation dialog all point towards reliable background tracking.  
However, a few **synchronisation gaps and calculation inaccuracies** need closing to make it truly robust and precise.

---

## 1. Fix the Native ↔ JS synchronisation to prevent step loss / double counting

**Problem**  
When the app starts, the JS layer seeds the native step total from SQLite without checking whether the native service already has a valid today‑total. More importantly, after seeding it does **not** update the sensor baseline (`last_sensor_total`). This can cause steps to be double‑counted (or lost) if the service was already running.

**Solution**  
- Add a native method to get the **stored date** and a method that resets the sensor baseline to the current hardware counter.  
- In the JS hook, only seed the native total if the native date ≠ today. After seeding, immediately reset the sensor baseline so future deltas start from the right point.

### Changes required

#### a) `BackgroundStepsModule.kt` – expose stored date & baseline reset  

*File:* `modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/BackgroundStepsModule.kt`  
*Approx. line after the existing AsyncFunctions (inside `definition()`)*

```kotlin
// Get the date for which the native daily total is currently valid
AsyncFunction("getDailyStepsDate") {
    prefs?.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
}

// Resets the sensor baseline to the *current* hardware counter value.
// Call this after injecting a historical total to prevent double-counting.
AsyncFunction("resetSensorBaseline") {
    val ctx = context ?: return@AsyncFunction
    val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as android.hardware.SensorManager
    val sensor = sm.getDefaultSensor(android.hardware.Sensor.TYPE_STEP_COUNTER)
    if (sensor != null) {
        // Reading the sensor once (or simply listening for one event) would be ideal,
        // but we can't force a synchronous read. Instead we set a flag that the next
        // sensor event should start from the current daily total.
        prefs?.edit()?.putBoolean("reset_baseline_on_next_event", true)?.apply()
    }
    // No-op if no sensor available.
    Unit
}
```

*Corresponding change in `StepTrackerService.kt`*  
In `onSensorChanged`, after the day‑rollover block, check for this flag:

*File:* `modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/StepTrackerService.kt`  
*Approx. inside `onSensorChanged`, before the delta calculation*

```kotlin
if (prefs.getBoolean("reset_baseline_on_next_event", false)) {
    prefs.edit()
        .putFloat(KEY_LAST_SENSOR_TOTAL, event.values[0])
        .putBoolean("reset_baseline_on_next_event", false)
        .apply()
    // Skip delta calculation for this event – we only want to realign the baseline
    return
}
```

#### b) `widgetBridge.ts` – export the new native functions  

*File:* `utils/widgetBridge.ts`  
*After the existing `getTotalDailySteps` function* (approx. line 100+)

```ts
export async function getDailyStepsDate(): Promise<string> {
  if (Platform.OS !== 'android') return '';
  try {
    const bg = getBackgroundStepsModule();
    return (await bg?.getDailyStepsDate()) ?? '';
  } catch { return ''; }
}

export async function resetSensorBaseline(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const bg = getBackgroundStepsModule();
    await bg?.resetSensorBaseline();
  } catch {}
}
```

#### c) `useStepTracker.ts` – smarter seeding with baseline reset  

*File:* `hooks/useStepTracker.ts`  
*Replace the seeding block (approx. lines 96–110)*

```ts
// 6. Read native total and stored date; seed only if native is behind *and* its date is stale
let nativeTotal = await getTotalDailySteps();
const nativeDate = await getDailyStepsDate();
const today = format(new Date(), 'yyyy-MM-dd');

if (nativeDate !== today) {
  // Service doesn’t have today’s data → inject SQLite baseline & realign sensor
  if (baselineSteps > 0) {
    await setTotalDailySteps(baselineSteps);
    nativeTotal = baselineSteps;
    await resetSensorBaseline();       // prevent double‑counting of future deltas
  }
} else if (nativeTotal < baselineSteps) {
  // Unusual but possible: DB has newer data → still realign sensor
  await setTotalDailySteps(baselineSteps);
  nativeTotal = baselineSteps;
  await resetSensorBaseline();
}
```

---

## 2. Fix monthly calorie over‑estimation

**Problem**  
`getYearHistory` feeds the **entire month’s steps** into `calculateCalories`, which expects **daily** steps. This inflates calorie/distance values.

**Solution**  
Remove calorie & distance from the monthly aggregation (display only monthly totals), or compute a daily average.

*File:* `store/fitnessStore.ts`  
*Inside `getYearHistory`, around the line where `calories` and `distance` are calculated* (approx. line ~130)

```ts
yearData.push({
  date: `${today.getFullYear()}-${String(month + 1).padStart(2, '0')}-01`,
  steps: monthSteps,
  floors: monthFloors,
  activeMinutes: monthActiveMinutes,
  calories: 0,   // Do not calculate monthly calories from raw total
  distance: 0,
});
```

If you still want a calorie estimate, compute `averageDailySteps = monthSteps / daysInMonth` and pass that through `calculateCalories`, but it’s rarely meaningful.

---

## 3. Add the missing `BootReceiver` implementation

The module’s manifest declares a `BootReceiver`, but the Kotlin class is not shown. Make sure it exists:

*File:* `modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/BootReceiver.kt`  

```kotlin
package expo.modules.nfitbackgroundsteps

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            StepTrackerService.startService(context)
        }
    }
}
```

---

## 4. (Optional) Replace 2‑second polling with native event emitter

Polling every 2 seconds is acceptable but wastes CPU. A more efficient approach:  
- In `StepTrackerService.kt`, after updating the daily total, send an event via `RCTDeviceEventEmitter`.  
- In JS, subscribe to that event and update the store.

This removes the timer and gives instant UI updates.  
*Line references:* Add event emission in `onSensorChanged` and add a native module method to start listening, then in the hook replace the `setInterval` with an event listener.

---

## 5. Small improvements

- **Notification icon** (StepTrackerService.kt, line `setSmallIcon(android.R.drawable.ic_dialog_info)`): replace with a custom `ic_stat_nfit` for branding.  
- **Remove unused permissions** from `AndroidManifest.xml`: `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE` are not needed for step tracking and may raise review flags.  
- **Step‑to‑floors/active‑minutes formulas** (`useStepTracker.ts`, `updateStepsFromNative`) are rough placeholders. For a precise fitness app, those should eventually come from dedicated altitude / motion analysis, but they don’t break core step accuracy.

---

## Verdict

The native `TYPE_STEP_COUNTER` foreground service + WorkManager watchdog + boot receiver is a **production‑grade backbone** for precise, background step counting. With the synchronisation fixes above (especially the sensor baseline realignment), you eliminate the few remaining data‑integrity risks and can confidently rely on the reported step counts.

The architecture is **production‑ready at its core** – a native foreground service using `TYPE_STEP_COUNTER`, a WorkManager watchdog, boot receiver, and battery‑optimisation dialog. It counts steps accurately even with the screen off and across reboots.

However, **two synchronisation gaps** can cause step loss or double‑counting when the app restarts while the native service was already running. Fixing them ensures precise, trustworthy counts in every scenario.

---

## Final required changes (file + line)

### 1. Add `KEY_DAILY_STEPS_DATE` constant to the native module

The module currently uses `KEY_DAILY_STEPS_DATE` (in `getDailyStepsDate` and `resetSensorBaseline` we’ll add) but doesn’t define it.  

**File:** `modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/BackgroundStepsModule.kt`  
**Line:** inside `companion object` (around line 157), add:

```kotlin
const val KEY_DAILY_STEPS_DATE = "daily_steps_date"
```

### 2. Expose `getDailyStepsDate` and `resetSensorBaseline` in the native module

Add these two `AsyncFunction`s inside `definition()`, after the existing `setTotalDailySteps` block.

**File:** `BackgroundStepsModule.kt`  
**Line:** after line ~90 (after `setTotalDailySteps` closing brace)

```kotlin
AsyncFunction("getDailyStepsDate") {
    prefs?.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
}

AsyncFunction("resetSensorBaseline") {
    val ctx = context ?: return@AsyncFunction
    val sm = ctx.getSystemService(android.content.Context.SENSOR_SERVICE) as android.hardware.SensorManager
    val sensor = sm.getDefaultSensor(android.hardware.Sensor.TYPE_STEP_COUNTER)
    if (sensor != null) {
        // Set a flag so the next sensor event realigns the baseline
        prefs?.edit()?.putBoolean("reset_baseline_on_next_event", true)?.apply()
    }
    // The actual baseline reset happens in StepTrackerService.onSensorChanged
    Unit
}
```

### 3. Handle `reset_baseline_on_next_event` flag in the step sensor callback

In `onSensorChanged`, **before** the delta calculation, realign the baseline if the flag is set.

**File:** `modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/StepTrackerService.kt`  
**Line:** after the day‑rollover check (approx. line 131), insert:

```kotlin
if (prefs.getBoolean("reset_baseline_on_next_event", false)) {
    if (isCounter) {
        prefs.edit()
            .putFloat(KEY_LAST_SENSOR_TOTAL, event.values[0])
            .putBoolean("reset_baseline_on_next_event", false)
            .apply()
        return  // skip delta, baseline now aligns with current daily total
    }
}
```

### 4. Export the new native functions to the JS layer

**File:** `utils/widgetBridge.ts`  
**Line:** after `getTotalDailySteps` (approx. line 108)

```ts
export async function getDailyStepsDate(): Promise<string> {
  if (Platform.OS !== 'android') return '';
  try {
    const bg = getBackgroundStepsModule();
    return (await bg?.getDailyStepsDate()) ?? '';
  } catch { return ''; }
}

export async function resetSensorBaseline(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const bg = getBackgroundStepsModule();
    await bg?.resetSensorBaseline();
  } catch {}
}
```

### 5. Smart seeding in the React hook – use native date, reset baseline

Replace the seeding block to avoid double‑counting when the native service was already counting.

**File:** `hooks/useStepTracker.ts`  
**Line:** Replace the block from “// 6. Read native total…” (around line 96) with:

```ts
// 6. Read native total and its date; seed only when native date is stale
const nativeTotal = await getTotalDailySteps();
const nativeDate = await getDailyStepsDate();
const today = format(new Date(), 'yyyy-MM-dd');

if (nativeDate !== today) {
  // Native service has no today data → inject SQLite baseline and realign
  if (baselineSteps > 0) {
    await setTotalDailySteps(baselineSteps);
  }
  await resetSensorBaseline();
} else if (nativeTotal < baselineSteps) {
  // Rare: SQLite is ahead (e.g., another device sync) → catch up
  await setTotalDailySteps(baselineSteps);
  await resetSensorBaseline();
}
```

Also adjust the initial state line (after seeding) to use the corrected total:

```ts
// 7. Set initial state
const finalSteps = baselineSteps > 0 && nativeDate !== today ? baselineSteps : nativeTotal;
if (mounted) {
  updateStepsFromNative(finalSteps > 0 ? finalSteps : 0);
  notifyWidget(finalSteps);
}
```

**Note:** You must import `getDailyStepsDate` and `resetSensorBaseline` from `widgetBridge` at the top of the file.

### 6. Fix massively over‑estimated monthly calories/distance

`getYearHistory` feeds a **full month’s steps** into `calculateCalories` which expects daily values. Remove calories and distance from the monthly aggregates.

**File:** `store/fitnessStore.ts`  
**Line:** inside `getYearHistory`, where the month’s entry is pushed (approx. line 130)

Change from:
```ts
calories: profile ? calculateCalories(monthSteps, profile.weight, profile.useMetric) : 0,
distance: profile ? calculateDistance(monthSteps, profile.height, profile.useMetric) : 0,
```
to:
```ts
calories: 0,   // monthly aggregation cannot be passed directly to daily formulas
distance: 0,
```

### 7. Replace the generic notification icon with a custom one

The foreground service notification currently uses `android.R.drawable.ic_dialog_info`, which is not branded and may look unprofessional.

**File:** `modules/nfit-background-steps/android/src/main/kotlin/expo/modules/nfitbackgroundsteps/StepTrackerService.kt`  
**Line:** in `buildNotification`, `setSmallIcon` call (around line 210)

Change:
```kotlin
.setSmallIcon(android.R.drawable.ic_dialog_info)
```
to a custom drawable added to your Android resources (e.g., `ic_stat_nfit`):
```kotlin
.setSmallIcon(applicationContext.resources.getIdentifier("ic_stat_nfit", "drawable", applicationContext.packageName))
```
(Alternatively, if you’ve added a PNG in `res/drawable`, the name will be auto‑resolved.)

### 8. (Optional but recommended) Remove unnecessary permissions

The app declares `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, and `WRITE_EXTERNAL_STORAGE`. None are needed for step tracking. Remove them from both the app‑level manifest and the module’s manifest.

**File:** `android/app/src/main/AndroidManifest.xml`  
**Lines:** remove these permission entries
```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
```

**File:** `modules/nfit-background-steps/android/src/main/AndroidManifest.xml`  
*No such permissions there, so no change.*

---

## Summary

With these changes:

- **No double counting** – the sensor baseline is always aligned when historical data is injected.  
- **No lost steps** – the native service is the sole counter; JS only reads and never resets without realignment.  
- **Correct calorie/distance for history** – monthly views no longer show inflated numbers.  
- **Polished notification** – custom icon improves trust.  
- **Cleaner manifest** – fewer permissions reduce review friction.

The app is now truly **production‑grade** for step counting. The combination of a native foreground service, WorkManager watchdog, boot receiver, and battery‑optimisation dialog ensures steps are counted continuously, accurately, and survive any Android power‑saving mechanisms.



# Step Tracker Code Review

This is a genuinely sophisticated architecture (foreground service + hardware step counter + WorkManager watchdog + SQLite/Zustand sync + widget). Good instincts overall. But I found **one critical bug that breaks iOS entirely**, and **one critical bug that corrupts your daily counts on Android**. Details below.

---

## 🔴 CRITICAL #1: iOS has zero step tracking

Look at `widgetBridge.ts`:

```ts
export async function getTotalDailySteps(): Promise<number> {
  if (Platform.OS !== 'android') return 0;   // ← always 0 on iOS
  ...
}
export async function startBackgroundService(): Promise<boolean> {
  if (Platform.OS !== 'android') return false; // ← no-op on iOS
  ...
}
```

Your `useStepTracker.ts` setup flow is:
1. Check `Pedometer.isAvailableAsync()` → **true on iOS**
2. Request permission → **granted on iOS**
3. `startBackgroundService()` → no-ops silently on iOS
4. `getTotalDailySteps()` → **always returns 0 on iOS**
5. Poll every 2s → **always 0, forever**

Since the pedometer check succeeds, `simulateSteps()` is **never triggered** as a fallback either. The result: **iOS users see 0 steps (or a stale SQLite baseline) permanently.** You built an entire native Android pipeline but never wired up the iOS equivalent using `expo-sensors`' own `Pedometer.watchStepCount` / `getStepCountAsync`, which is what you should be using on iOS (backed by CMPedometer/HealthKit — no custom native module needed there).

### Fix
Branch the whole strategy by platform:

```ts
if (Platform.OS === 'ios') {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { steps: baseline } = await Pedometer.getStepCountAsync(startOfDay, new Date());
  let watchStart = baseline;
  updateStepsFromNative(baseline);

  const sub = Pedometer.watchStepCount(({ steps }) => {
    updateStepsFromNative(watchStart + steps);
  });

  // re-sync from source of truth periodically / on resume to avoid drift
  // (watchStepCount is delta-based, getStepCountAsync is authoritative)
} else {
  // existing Android native-service flow
}
```

Also re-fetch `getStepCountAsync` on `AppState → active` for iOS instead of `getTotalDailySteps()`.

---

## 🔴 CRITICAL #2: Day-rollover race condition (Android)

In `StepTrackerService.kt`, the day check only runs **inside `onSensorChanged`**:

```kotlin
val storedDate = prefs.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
if (storedDate != today) {
  // reset to 0
}
```

This means the reset **only fires when a step actually occurs**. Nobody takes steps while sleeping, so from midnight until the user's first step of the new day:

- `getTotalDailySteps()` keeps returning **yesterday's final total**
- Your JS `setup()` effect does this:
  ```ts
  let nativeTotal = await getTotalDailySteps(); // stale, large, from yesterday
  if (nativeTotal < baselineSteps) { ... }        // false, baselineSteps is 0 for new day
  updateStepsFromNative(nativeTotal);             // sets TODAY's steps to YESTERDAY's count!
  ```
- Worse, `fitnessStore`'s `todaySteps` is **persisted via zustand** (AsyncStorage), so on cold start the UI briefly shows yesterday's number before `setup()` even runs — and then `setup()` confirms it instead of correcting it.
- Eventually the user takes a step, the service resets to 0 and re-adds 1, and your poll loop sees a **massive drop** (e.g. 8,432 → 1) which is a jarring UI glitch and, if it lands right as `debouncedDbSave()` fires, could corrupt `stepHistory` for both days.

### Fix
Don't rely on sensor events to detect day changes. Two options, do both:

**A. JS-side guard (quick fix):** expose the stored date from native and compare against local date before trusting `nativeTotal`:

```kotlin
// BackgroundStepsModule.kt
AsyncFunction("getDailyStepsSnapshot") {
  mapOf(
    "steps" to (prefs?.getInt(KEY_DAILY_TOTAL_STEPS, 0) ?: 0),
    "date" to (prefs?.getString(StepTrackerService.KEY_DAILY_STEPS_DATE, "") ?: "")
  )
}
```

```ts
const { steps, date } = await getDailyStepsSnapshot();
const today = format(new Date(), 'yyyy-MM-dd');
const nativeTotal = date === today ? steps : 0; // discard stale cross-day value
```

**B. Native-side guard (robust fix):** schedule an **exact AlarmManager alarm at local midnight** that fires a rollover check/reset in the service regardless of sensor activity, instead of waiting for the next step. This guarantees the notification and stored total are correct even if the phone is idle overnight.

---

## 🟠 HIGH: Permanent WakeLock defeats the purpose of using a hardware step counter

```kotlin
private fun acquireWakeLock() {
  wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nfit:step_tracking").apply { acquire() }
}
```

This is held for the **entire lifetime of the service** (i.e., basically always, since you also request battery-optimization exemption + boot receiver + watchdog to keep it running forever). `TYPE_STEP_COUNTER` is specifically designed to run on a low-power co-processor *without* needing the CPU awake — that's the entire point of using it over the accelerometer. A permanent `PARTIAL_WAKE_LOCK`:

- Drains battery significantly (CPU never deep-sleeps)
- Will get flagged in Android Vitals as excessive wakelock
- May cause OEMs (Xiaomi, Samsung, etc.) or Play Console to penalize the app despite your battery-optimization-exemption efforts — you're fixing the OEM kill problem while creating a self-inflicted drain problem

**Fix:** Remove `acquireWakeLock()`/`releaseWakeLock()` entirely. The foreground service + sensor registration is sufficient to keep receiving step events; you don't need to hold the CPU awake to log a `SharedPreferences` write on each step.

---

## 🟠 HIGH: No fallback if the native module fails to load

```ts
function getBackgroundStepsModule() {
  if (!NfitBackgroundSteps) {
    try { NfitBackgroundSteps = requireNativeModule('NfitBackgroundSteps'); }
    catch { try { NfitBackgroundSteps = require('expo-modules-core').NativeModulesProxy.NfitBackgroundSteps; } catch { NfitBackgroundSteps = null; } }
  }
  return NfitBackgroundSteps;
}
```

If this ever returns `null` (bad dev build, module not linked, autolinking issue after an EAS update, etc.), **every function silently returns `0`/`false`** and the whole app shows 0 steps with no error surfaced and no fallback — on Android, where you actually have `expo-sensors` available as a backup.

**Fix:** If `getBackgroundStepsModule()` is null after the foreground service should've started, fall back to `Pedometer.watchStepCount()` (same as iOS) so the user at least gets *something* instead of a silent zero. Also consider surfacing a dev-only warning/telemetry event when this happens so you catch it in production instead of finding out from reviews.

---

## 🟡 MEDIUM: Over-broad Android permissions

```json
"android.permission.BODY_SENSORS",
"android.permission.HIGH_SAMPLING_RATE_SENSORS",
```

`TYPE_STEP_COUNTER`/`TYPE_STEP_DETECTOR` only require `ACTIVITY_RECOGNITION` (API 29+). `BODY_SENSORS` is for heart rate/biometric sensors, and `HIGH_SAMPLING_RATE_SENSORS` is for >200Hz raw sensor streaming — neither applies here. These are never actually requested at runtime (your `Pedometer.requestPermissionsAsync()` only asks for `ACTIVITY_RECOGNITION`), so they sit unused in the manifest. This can trigger extra scrutiny in Play Console's sensitive-permissions declaration form and Data Safety section for no benefit.

**Fix:** Remove both unless you have another feature actually using them.

---

## 🟡 MEDIUM: `isServiceRunning` uses a deprecated, unreliable API

```kotlin
@Suppress("DEPRECATION")
for (service in manager.getRunningServices(Int.MAX_VALUE)) { ... }
```

`getRunningServices` is deprecated and behavior varies by OEM/Android version (some versions restrict results even for your own app). Given how central "is my service alive" is to your battery-optimization/watchdog logic, this deserves a more deterministic source of truth.

**Fix:** Maintain an explicit flag:
```kotlin
// in onCreate(): prefs.edit().putBoolean(KEY_SERVICE_ALIVE, true).apply()
// in onDestroy(): prefs.edit().putBoolean(KEY_SERVICE_ALIVE, false).apply()
```
And read that flag from `isServiceRunning()` instead (or in addition, as a cross-check).

---

## 🟢 MINOR / Nitpicks

1. **`KEY_LAST_SENSOR_TOTAL` stored as `Float`** — step counter values are integral; float mantissa precision degrades above ~16.7M (not a near-term concern, but `Long`/`Double` is more correct).
2. **Dead code:** `getWidgetModule()`/`NfitWidget` in `widgetBridge.ts` is defined but never actually called — `refreshWidget()` uses `requestWidgetUpdate` from `react-native-android-widget` directly. Remove the unused native module lookup or wire it up if it was meant for something else.
3. **Redundant widget update paths:** the service sends both `com.reactnativeandroidwidget.UPDATE` (correct, triggers the library's headless JS render) *and* a raw `AppWidgetManager.ACTION_APPWIDGET_UPDATE` broadcast. The second is likely a no-op/backup since the library's own provider handles rendering — worth confirming it isn't causing double-renders or being silently ignored, but not harmful.
4. **`sendGoalReachedNotification`/streak logic** depends entirely on `todaySteps` being correct — so it directly inherits both critical bugs above (e.g., a false "goal reached" notification could fire on day-1 due to stale carryover steps from bug #2).
5. Consider debouncing `updateStepsFromNative` writes to the Zustand store more tightly with your SQLite debounce (3s) vs widget debounce (2s) vs poll interval (2s) — three independent timers touching the same state is a bit fragile; a single "steps changed" event bus feeding all three sinks would be cleaner.

---

## ✅ What's genuinely good here

- Using `TYPE_STEP_COUNTER` (hardware/co-processor-backed) as primary source instead of accelerometer-based custom step detection — correct call for accuracy.
- Sensor-reboot detection (`currentSensorTotal < savedLastSensor` → treat as delta from 0) is the right pattern.
- `START_STICKY` + `onTaskRemoved` restart + WorkManager watchdog + boot receiver is a solid defense-in-depth strategy against OEM process killing.
- Treating native service as single source of truth and having JS **only poll, never count** is the correct architecture in principle (bugs above are implementation details, not the concept).

---

## Files I still need to fully close out the review

- `modules/nfit-background-steps/android/.../BootReceiver.kt`
- `modules/nfit-background-steps/expo-module.config.json`
- `utils/database.ts` (`loadDailyStepsForDate`/`saveDailySteps`)
- `utils/notifications.ts` (need to confirm `POST_NOTIFICATIONS` runtime request exists for Android 13+, otherwise your foreground service notification may be silently suppressed)
- Confirm: is there **any** iOS-specific native code, or were you relying entirely on `expo-sensors` for iOS? (Answer changes how big a lift the iOS fix is)

Want me to write out the full iOS implementation + the JS-side day-rollover guard as ready-to-paste code?


# Step Tracking Review — Round 2 (Android-only)

Good, that simplifies things a lot — the iOS gap is moot. Reviewed the new files. Here's the updated picture.

---

## 🔴 STILL CRITICAL: Day-rollover race condition confirmed

This is unaffected by the new files and remains your #1 issue. To recap: the reset in `StepTrackerService.onSensorChanged()` only fires when a step event happens, so from midnight until the user's first step, `getTotalDailySteps()` keeps returning **yesterday's total**, and your JS layer will happily display it as today's count (possibly even firing a false "goal reached" notification instantly after midnight).

Since you have a 15-minute **WorkManager watchdog already running regardless of activity**, that's the natural place to also enforce the rollover — no need for a separate midnight alarm.

### Fix — add a rollover check independent of sensor events

```kotlin
// StepTrackerService.kt — add to companion object
companion object {
    // ...existing constants...

    fun checkAndResetIfNewDay(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val storedDate = prefs.getString(KEY_DAILY_STEPS_DATE, "") ?: ""
        if (storedDate.isNotEmpty() && storedDate != today) {
            prefs.edit()
                .putInt(KEY_DAILY_TOTAL_STEPS, 0)
                .putString(KEY_DAILY_STEPS_DATE, today)
                .putFloat(KEY_LAST_SENSOR_TOTAL, -1f) // forces re-baseline on next sensor event
                .putInt(KEY_ACCUMULATED_STEPS, 0)
                .apply()
        }
    }
}
```

Call it in three places:

```kotlin
// onCreate() — before registering the sensor listener
override fun onCreate() {
    super.onCreate()
    checkAndResetIfNewDay(applicationContext)
    // ...rest unchanged
}

// onStartCommand() — covers restarts (boot, watchdog, task-removed alarm)
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    checkAndResetIfNewDay(applicationContext)
    startForegroundServiceWithNotification()
    return START_STICKY
}
```

```kotlin
// StepTrackerWorker.kt — check every 15 min even if service never restarts
override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    try {
        StepTrackerService.checkAndResetIfNewDay(applicationContext)
        StepTrackerService.startService(applicationContext)
        Result.success()
    } catch (e: Exception) {
        Result.retry()
    }
}
```

This guarantees the reset happens within 15 minutes of midnight even with zero user activity, instead of waiting for the first step of the day.

### Defense-in-depth on the JS side (cheap, worth adding anyway)

Expose the stored date alongside the count so JS can independently discard stale values:

```kotlin
// BackgroundStepsModule.kt
AsyncFunction("getDailyStepsSnapshot") {
    mapOf(
        "steps" to (prefs?.getInt(KEY_DAILY_TOTAL_STEPS, 0) ?: 0),
        "date" to (prefs?.getString(StepTrackerService.KEY_DAILY_STEPS_DATE, "") ?: "")
    )
}
```

```ts
// widgetBridge.ts
export async function getDailyStepsSnapshot(): Promise<{ steps: number; date: string }> {
  try {
    const bg = getBackgroundStepsModule();
    return (await bg?.getDailyStepsSnapshot?.()) ?? { steps: 0, date: '' };
  } catch {
    return { steps: 0, date: '' };
  }
}
```

```ts
// useStepTracker.ts — replace getTotalDailySteps() usage
const { steps, date } = await getDailyStepsSnapshot();
const today = format(new Date(), 'yyyy-MM-dd');
const nativeTotal = date === today ? steps : 0;
```

---

## 🟠 HIGH: Permanent WakeLock (unchanged from last review, repeating because it matters)

Still present in `StepTrackerService.kt`. `TYPE_STEP_COUNTER` runs on the low-power co-processor specifically so you *don't* need the CPU awake. Holding a `PARTIAL_WAKE_LOCK` for the service's entire lifetime (which, combined with your boot receiver + battery-optimization exemption + watchdog, means *forever*) will show up as excessive wakelock usage in Android Vitals and burns battery for no accuracy gain.

**Fix: delete `acquireWakeLock()`/`releaseWakeLock()` and their call sites entirely.**

---

## 🟡 NEW: Notification permission — confirm it's actually requested

`utils/notifications.ts` defines `requestNotificationPermissions()`, but it's **not called anywhere** in the files reviewed so far (not in `useStepTracker.ts`, not in the service setup flow).

On Android 13+ (API 33), if `POST_NOTIFICATIONS` runtime permission is never granted:
- Your foreground service notification (`buildNotification`) won't be visible to the user — the service still legally runs in the foreground, but the user has no visibility/control over it (can't force-stop it from the notification shade), which looks broken from a UX standpoint.
- `sendGoalReachedNotification()` / `sendStreakNotification()` will silently do nothing (wrapped in `try/catch` with no fallback), so users hit their goal and get **no feedback at all** — a pretty significant silent failure for a fitness app's core gamification loop.

**Action needed:** confirm where (and whether) `requestNotificationPermissions()` is invoked — ideally on onboarding/first launch, before the step tracker starts. If it's genuinely missing, wire it in near the top of your app init flow, before `useStepTracker`'s setup effect runs.

---

## 🟡 MEDIUM: Dead/unused table — `step_counter_state`

`database.ts` defines and initializes a full `step_counter_state` table with `loadStepCounterState()` / `saveStepCounterState()`, but neither function is called anywhere in `useStepTracker.ts` or `fitnessStore.ts`. Your actual baseline logic reads from `daily_steps` via `loadDailyStepsForDate()` instead.

This looks like leftover scaffolding from an earlier architecture (probably pre-native-module, when JS itself tracked accumulated steps). It's harmless as dead code, but:
- It's actively misleading for anyone debugging step data later ("wait, which table is the source of truth?")
- It adds a stray row + unnecessary writes-that-never-happen setup

**Fix:** Either remove the table + functions, or if you intend to use it for something (e.g. crash recovery journal), document that intent — otherwise delete it.

---

## 🟢 Re-evaluated from last review (downgrading)

- **`isServiceRunning` via `getRunningServices`**: I flagged this as risky last time, but since you're only querying *your own app's* running services (not another app's), this API generally still works correctly despite the deprecation — the restriction Google added targets querying *other* apps' services. I'm downgrading this to a non-issue; no change needed unless you observe actual false negatives on specific OEMs in testing.

---

## 🟡 Permissions cleanup (repeat from last round, still applies)

`BODY_SENSORS` and `HIGH_SAMPLING_RATE_SENSORS` in `app.json`/manifest are unused — you only request `ACTIVITY_RECOGNITION` at runtime via `Pedometer.requestPermissionsAsync()`, and `TYPE_STEP_COUNTER`/`TYPE_STEP_DETECTOR` don't need either. Remove both to avoid unnecessary sensitive-permission flags in Play Console's Data Safety form.

---

## Priority order to fix

1. **Day rollover** (native watchdog check + JS snapshot guard) — silently wrong step counts / false goal notifications
2. **Confirm notification permission is requested somewhere** — otherwise goal/streak notifications are dead in production
3. **Remove permanent WakeLock** — battery drain, defeats purpose of hardware step counter
4. Clean up unused `step_counter_state` table
5. Trim unused Android permissions

Want me to also check your `PermissionsGate`/onboarding flow file (wherever `requestNotificationPermissions` *should* be called) to close out item #2, or is that confirmed already on your end?
