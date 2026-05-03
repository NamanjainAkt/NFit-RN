# Nfit Bug Fix & Refactoring Plan

## Goal
Fix critical bugs in sensor handling, data synchronization, streak calculation, unit consistency, and input validation while improving code maintainability.

## Tasks

### 1. Android Pedometer Fix
- [x] Modify `app/(tabs)/index.tsx` to use `Pedometer.isAvailableAsync()` on Android instead of defaulting to simulation.
- [x] Update `checkPedometerPermission` logic to properly handle permission requests and real-time updates on Android.
- Verify: Test on Android emulator/device to see if it attempts to use real sensors.

### 2. Step History Synchronization
- [x] Update `useFitnessStore` in `store/fitnessStore.ts` to automatically sync `todaySteps` with `stepHistory`.
- [x] Modify `setTodaySteps` to trigger `recordDay` or similar logic.
- Verify: Change steps, then check `getWeekHistory()` to ensure it reflects the latest `todaySteps`.

### 3. Streak Calculation Logic
- [x] Update `updateStepStreak` in `store/userStore.ts` to handle timezones correctly using `date-fns`.
- [x] Ensure "today" vs "yesterday" logic is robust against late-night activity.
- Verify: Manually set `lastActiveDate` to yesterday and verify streak increments today.

### 4. Metric/Imperial Inconsistency
- [x] Update `calculateCalories` in `store/fitnessStore.ts` to account for `useMetric` flag from profile.
- [x] Adjust calorie multiplier if weight is in lbs (currently assumes kg or constant multiplier).
- Verify: Toggle between Metric and Imperial in settings and observe calorie calculation changes.

### 5. Onboarding Input Validation
- [x] Add numeric validation and range checks in `app/onboarding.tsx`.
- [x] Ensure "Get Started" is disabled if inputs are invalid (e.g., negative weight, zero height).
- Verify: Try entering non-numeric characters or absurd values in onboarding.

### 6. Code Quality Refactoring
- [x] Create `hooks/useStepTracker.ts` to extract pedometer and step logic from `index.tsx`.
- [x] Create `hooks/useFitnessStats.ts` to extract calculation and summary logic.
- [x] Refactor `app/(tabs)/index.tsx` to use these custom hooks.
- Verify: App functionality remains identical but `index.tsx` is significantly smaller and more readable.

## Done When
- [ ] All 5 bugs are fixed and verified.
- [ ] `index.tsx` is refactored using custom hooks.
- [ ] Code follows `clean-code` and `architecture` principles.
