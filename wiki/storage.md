# Storage Adapter

> `utils/storage.ts` | Zustand persistence bridge

## Purpose
Provides a storage adapter that Zustand's `persist` middleware uses. Implements the `getItem`, `setItem`, `removeItem` interface.

## Strategy
1. **Primary**: SQLite via `getAppState`/`setAppState`/`deleteAppState` from [[database]] (keys prefixed with `zustand:`)
2. **Fallback**: `@react-native-async-storage/async-storage` if SQLite fails

This gives reliable persistence on Android where AsyncStorage can be cleared by the system.

## Used By
- [[user-store]] — `user-storage` key
- [[fitness-store]] — `fitness-storage` key
