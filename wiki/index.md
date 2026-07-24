# Nfit Wiki Index

> Auto-maintained by LLM. Updated on every ingest. Last ingest: 2026-07-11.

## Overview

Nfit is a React Native / Expo fitness tracking app (v1.2.1) that counts steps via the device pedometer sensor, logs workouts, and visualizes activity history. Android-only for native modules (widget, background service). Uses Expo Router for file-based navigation, Zustand for state, SQLite for persistence, and a dual storage strategy (SQLite primary, AsyncStorage fallback).

## Screens (app/)

| Page | File | Summary |
|------|------|---------|
| [[root-layout]] | `app/_layout.tsx` | Root layout: hydration gate, dark mode, error boundary, stack navigator |
| [[onboarding]] | `app/onboarding.tsx` | Two-step onboarding: profile collection + permission requests |
| [[error-boundary]] | `app/error-boundary.tsx` | Global error boundary with reset button |
| [[tabs-layout]] | `app/(tabs)/_layout.tsx` | Tab navigator: Home, Workouts, History, Analytics, Settings |
| [[home-screen]] | `app/(tabs)/index.tsx` | Home: step ring, stat cards, confetti on goal, notification scheduling |
| [[workouts-screen]] | `app/(tabs)/workouts.tsx` | Workout wizard (3-step: type, duration, review) + workout list |
| [[history-screen]] | `app/(tabs)/history.tsx` | Week/month/year bar charts, calendar heatmap, streak display |
| [[analytics-screen]] | `app/(tabs)/analytics.tsx` | Deep analytics: trends, week-over-week, breakdowns, calendar heatmap |
| [[settings-screen]] | `app/(tabs)/settings.tsx` | Profile editing, goals, preferences, data export, reset |

## State Management (store/)

| Page | File | Summary |
|------|------|---------|
| [[user-store]] | `store/userStore.ts` | UserProfile, workouts, streak, onboarding state. Persisted via zustandStorage |
| [[fitness-store]] | `store/fitnessStore.ts` | Today's steps/floors/activeMinutes, stepHistory[], history queries. Persisted + synced to SQLite |

## Hooks (hooks/)

| Page | File | Summary |
|------|------|---------|
| [[use-step-tracker]] | `hooks/useStepTracker.ts` | Dual-mode step tracking: accelerometer StepDetector (primary), pedometer + cadence filter (fallback). Baseline restore, widget sync, goal notifications |
| [[use-fitness-stats]] | `hooks/useFitnessStats.ts` | Derived stats: calories, distance, goal progress from today's data |

## Utilities (utils/)

| Page | File | Summary |
|------|------|---------|
| [[calculations]] | `utils/calculations.ts` | `calculateCalories(steps, weight, useMetric)`, `calculateDistance(steps, height, useMetric)` |
| [[database]] | `utils/database.ts` | SQLite schema (daily_steps, step_counter_state, workouts, profile, app_state), CRUD operations |
| [[storage]] | `utils/storage.ts` | Zustand storage adapter: SQLite primary, AsyncStorage fallback |
| [[notifications]] | `utils/notifications.ts` | Permission request, channels (default/reminders/achievements), goal/streak, hourly reminders 8am-8pm |
| [[theme]] | `utils/theme.ts` | Light/dark color palettes, spacing tokens, `getColors(darkMode)` |
| [[export]] | `utils/export.ts` | JSON/CSV export of step history + workouts via expo-sharing |
| [[widget-bridge]] | `utils/widgetBridge.ts` | Widget update + background step bridge |
| [[step-detector]] | `utils/stepDetector.ts` | Accelerometer-based step detection with adaptive threshold |
| [[step-filter]] | `utils/stepFilter.ts` | Cadence & burst filter for pedometer fallback |

## Widget (widget/)

| Page | File | Summary |
|------|------|---------|
| [[widget-task-handler]] | `widget/widget-task-handler.tsx` | React widget render handler using `react-native-android-widget` |
| `NfitWidget.tsx` | `widget/NfitWidget.tsx` | Widget UI component: steps, goal progress |

## Native Modules (modules/)

| Page | File | Summary |
|------|------|---------|
| [[nfit-background-steps]] | `modules/nfit-background-steps/` | Android background step tracking: WorkManager (15min), no foreground service |

## Components (components/)

| Page | File | Summary |
|------|------|---------|
| [[confetti]] | `components/Confetti.tsx` | 60-particle confetti animation on goal achievement |

## Concepts

| Page | Summary |
|------|---------|
| [[architecture]] | Overall app architecture: Expo Router, dual storage, native modules, data flow |
| [[data-flow]] | How step data flows: Pedometer -> useStepTracker -> fitnessStore -> SQLite -> widget |
| [[dual-storage]] | SQLite-primary with AsyncStorage fallback for Zustand persistence |
| [[calorie-calculation]] | Calorie formula: steps * weightKg * 0.0005 |
| [[distance-calculation]] | Distance formula: stride = height * 0.415, then steps * stride / conversion factor |

## Source Documents

| File | Summary |
|------|---------|
| `docs/PLAN.md` | Bug fix & refactoring plan (all tasks checked off) |
| `package.json` | Expo 55, React 19.2, RN 0.83, Zustand 5, expo-sensors, expo-sqlite |
| `app.json` | Expo config: v1.2.1, Android permissions, plugins, adaptive icon |
