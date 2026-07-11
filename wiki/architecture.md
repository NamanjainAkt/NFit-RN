# Architecture

> Overall system architecture of Nfit

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.83 + Expo 55 |
| Navigation | Expo Router (file-based) |
| State | Zustand 5 with persist middleware |
| Database | expo-sqlite (primary) + AsyncStorage (fallback) |
| Sensors | expo-sensors (Pedometer) |
| Native Modules | Expo Modules API (Kotlin) |
| Language | TypeScript (strict mode) |

## High-Level Architecture

```
┌─────────────────────────────────────────────┐
│                  UI Layer                    │
│  Screens (app/)  ←  Hooks (hooks/)          │
│                      ↓                      │
│              State Layer                     │
│  userStore.ts  ←→  fitnessStore.ts          │
│       ↓                ↓                    │
│            Persistence Layer                 │
│  storage.ts (SQLite primary, AS fallback)   │
│            ↓                                │
│         SQLite (nfit.db)                     │
└─────────────────────────────────────────────┘
         ↕ (native bridge)
┌─────────────────────────────────────────────┐
│            Native Layer (Android)            │
│  nfit-widget        nfit-background-steps    │
│  (Home Widget)      (FG Service + WorkMgr)  │
└─────────────────────────────────────────────┘
```

## Key Patterns

### File-Based Routing
`app/_layout.tsx` defines root Stack. `app/(tabs)/_layout.tsx` defines 5-tab navigator. Each `.tsx` file in `app/(tabs)/` is a screen.

### Dual Storage
All Zustand persistence goes through `zustandStorage` adapter which tries SQLite first, falls back to AsyncStorage. The `daily_steps` table is also written directly by the fitness store (debounced 3s) for the widget/background service to read.

### Native Module Bridge
`widgetBridge.ts` lazily loads native modules via `requireNativeModule()` with fallback to `NativeModulesProxy`. The JS side pushes data; the native side renders widgets and runs foreground services.

### Custom Hooks
`useStepTracker` and `useFitnessStats` extract business logic from screens. The home screen is a thin rendering layer.

## Related Pages
- [[data-flow]] — detailed step data flow
- [[dual-storage]] — storage strategy details
