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

## [2026-07-11] fix | Step persistence on app restart

Fixed step counter resetting to 0 on app restart. Two root causes:
1. `useStepTracker` only fell back to Zustand `stepHistory` on SQL errors (catch), not when SQLite returned null (the `daily_steps` table is debounced at 3s, so data is often missing on quick restarts).
2. `_layout.tsx` only waited for `userStore` hydration; `fitnessStore` might not be rehydrated when the step tracker reads `stepHistory`.

Changes:
- `app/_layout.tsx` — wait for both stores to rehydrate before rendering
- `hooks/useStepTracker.ts` — move fallback to `stepHistory` into an `else` branch covering the null-result case

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
