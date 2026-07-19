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
│  (Home Widget)      (WorkManager 15min)     │
└─────────────────────────────────────────────┘
```

## Key Patterns

### File-Based Routing
`app/_layout.tsx` defines root Stack. `app/(tabs)/_layout.tsx` defines 5-tab navigator. Each `.tsx` file in `app/(tabs)/` is a screen.

### Dual Storage
All Zustand persistence goes through `zustandStorage` adapter which tries SQLite first, falls back to AsyncStorage. The `daily_steps` table is also written directly by the fitness store (debounced 3s) for the widget to read.

### Hybrid Background Tracking
Background step tracking uses WorkManager (every 15 min) reading the hardware TYPE_STEP_COUNTER sensor. On app start, JS reads the WorkManager-accumulated total as baseline via native bridge. When app is open, JS Pedometer provides real-time increments. No foreground service, no wakelock, no persistent notification.

### Native Module Bridge
`widgetBridge.ts` lazily loads native modules via `requireNativeModule()` with fallback to `NativeModulesProxy`. JS pushes widget data and reads WorkManager accumulated steps from native side.

### Custom Hooks
`useStepTracker` and `useFitnessStats` extract business logic from screens. The home screen is a thin rendering layer.

## Related Pages
- [[data-flow]] — detailed step data flow
- [[dual-storage]] — storage strategy details
- [[nfit-background-steps]] — WorkManager background tracking
