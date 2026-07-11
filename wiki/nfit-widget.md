# Nfit Widget (Native Module)

> `modules/nfit-widget/` | Android home screen widget

## Purpose
Provides an Android AppWidget that displays steps, calories, distance, streak, floors, active minutes on the home screen.

## Architecture
- **Expo Module**: `NfitWidgetModule.ts` (TypeScript) — defines `updateWidgetData(data)` async function
- **Kotlin Provider**: `NfitWidgetProvider.kt` — `AppWidgetProvider` subclass, handles widget updates
- **Kotlin Module**: `NfitWidgetModule.kt` — bridges Expo to native `AppWidgetManager`

## Widget Layout
- `nfit_widget.xml` — RemoteViews layout
- `widget_progress.xml` — Progress drawable
- `widget_background.xml` — Background drawable
- `badge_streak.xml` — Streak badge

## Configuration
- `nfit_widget_info.xml` — minWidth/minHeight, update period, preview layout
- `expo-module.config.json` — module registration
- `android/build.gradle` — AAR build config

## Output
- `nfit-widget-release.aar`, `nfit-widget-debug.aar` in build outputs

## Dependencies
- [[widget-bridge]] — JS-side bridge
