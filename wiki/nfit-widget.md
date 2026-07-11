# Nfit Widget (Native Module)

> `modules/nfit-widget/` | Android home screen widget

## Purpose
Provides an Android AppWidget that displays steps, calories, distance, streak, floors, active minutes on the home screen.

## Architecture
- **Expo Module**: `NfitWidgetModule.ts` (TypeScript) — defines `updateWidgetData(data)` async function
- **Kotlin Provider**: `NfitWidgetProvider.kt` (host app) — `AppWidgetProvider` subclass, handles widget updates
- **Kotlin Module**: `NfitWidgetModule.kt` (expo module) — bridges Expo to native `AppWidgetManager`

## Widget Layout

### Current Design (Material 3 — Pixel/Nothing OS aesthetic)
Minimal, flat, premium design. Dark subtle gradient background (#191C22 → #15171C), 24dp radius, 8% opacity border.

- `nfit_widget.xml` — RemoteViews layout:
  - Header: "STEPS TODAY" label (left) + streak pill badge (right, solid #232323, amber #F6A623)
  - Hero step count: 46sp white, turns green #4CAF50 at goal
  - Goal-reached badge: transparent pill with green border, hidden until 100%
  - Progress bar: 8dp thick, track #2A2D36, tint colors: #EF5350 → #FB8C00 → #FDD835 → #8BC34A → #4CAF50
  - Metrics row (4 columns): CAL #EF5350, DIST #42A5F5, FLR #66BB6A, MIN #AB47BC

- `widget_progress.xml` — Progress drawable (layer-list with clip)
- `widget_background.xml` — Background drawable (gradient + stroke)
- `badge_streak.xml` — Streak pill (solid #232323, 18dp radius)
- `badge_goal_reached.xml` — Goal badge (transparent, #4CAF50 border, 12dp radius)
- `divider_widget.xml` — Metrics divider (30% opacity #2A2D36)

## Configuration
- `nfit_widget_info.xml` — 4×3 target cells, resizeable, updatePeriodMillis=0
- `strings.xml` — widget_description
- `expo-module.config.json` — module registration
- `android/build.gradle` — AAR build config

## Data Flow
1. JS calls `refreshWidget()` from `widgetBridge.ts`
2. `NfitWidgetModule.updateWidgetData()` writes to SharedPreferences
3. `NfitWidgetProvider.onUpdate()` reads prefs, builds RemoteViews, pushes to `AppWidgetManager`

## Output
- `nfit-widget-release.aar`, `nfit-widget-debug.aar` in build outputs

## Dependencies
- [[widget-bridge]] — JS-side bridge
