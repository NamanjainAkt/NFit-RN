# Root Layout

> `app/_layout.tsx` | Entry point for the app's navigation

## Purpose
Waits for Zustand hydration, wraps the entire app in an `ErrorBoundary`, sets the status bar style based on dark mode, and defines the root Stack navigator.

## Key Behavior
- **Hydration gate**: Returns `null` until `useUserStore.persist.hasHydrated()` resolves. Listens via `onFinishHydration` listener.
- **Dark mode**: Reads `profile?.darkMode` from userStore. Background color switches between `#121212` (dark) and `#F8F9FA` (light).
- **ErrorBoundary**: Wraps all children. On error shows a red alert icon + "Try Again" button.
- **Screens**: `(tabs)` (headerless) and `onboarding` (fullScreenModal, slide_from_bottom).

## Dependencies
- [[user-store]] — hydration state, darkMode
- [[error-boundary]] — error boundary component

## Notes
- The hydration wait is necessary because Zustand's `persist` middleware rehydrates from storage async. Without it, the UI would flash before data loads.
