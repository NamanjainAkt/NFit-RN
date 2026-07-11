# Tabs Layout

> `app/(tabs)/_layout.tsx` | Bottom tab navigator configuration

## Purpose
Defines the 5-tab navigation structure: Home, Workouts, History, Analytics, Settings.

## Tab Bar Configuration
- Background: `c.surface`, top border: `c.border`
- Height: `60 + insets.bottom` (safe area aware)
- Active tint: `c.accent`, inactive: `c.textTertiary`
- Icons from Ionicons, filled variant when focused

## Dependencies
- [[user-store]] — darkMode
- [[theme]] — `getColors()`
- `react-native-safe-area-context` — `useSafeAreaInsets()`
