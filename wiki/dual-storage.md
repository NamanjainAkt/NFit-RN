# Dual Storage

> Nfit's SQLite-primary with AsyncStorage-fallback persistence strategy

## Problem
React Native apps need persistent storage for Zustand state. AsyncStorage is the default but can be cleared by the Android system, and has no transactional guarantees. SQLite is more reliable but requires manual schema management.

## Solution
The `zustandStorage` adapter in [[storage]] wraps both:

```
Zustand Persist Middleware
    ↓ getItem / setItem / removeItem
zustandStorage adapter
    ├→ Try SQLite (getAppState/setAppState/deleteAppState)
    └→ Fallback: AsyncStorage
```

## Why Two Layers?
1. **Reliability**: SQLite survives system storage cleanup better than AsyncStorage on Android
2. **Widget access**: The native widget module can read from SQLite directly but not from AsyncStorage
3. **Background service**: The step tracker worker reads/writes SQLite for persistence across process kills

## Tables Used
| Table | Purpose | Written By |
|-------|---------|-----------|
| `app_state` | Zustand serialized state (key-value) | storage.ts |
| `daily_steps` | Daily step data (also read by widget) | database.ts (direct), fitnessStore (debounced) |
| `step_counter_state` | Pedometer accumulator | useStepTracker |
| `profile` | User profile (currently only in Zustand) | database.ts (unused in normal flow) |
| `workouts` | Workouts (currently only in Zustand) | database.ts (unused in normal flow) |

## Notes
- The `profile` and `workouts` tables exist in the schema but are not actively written to in the normal flow. They could be used for future native module access or as a backup.
