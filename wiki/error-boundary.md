# Error Boundary

> `app/error-boundary.tsx` | React class component error boundary

## Purpose
Catches unhandled render errors anywhere in the component tree. Shows a centered error card with the error message and a "Try Again" button that resets state.

## Key Details
- Class component extending `React.Component<Props, State>`
- Uses `getDerivedStateFromError` for error capture
- Hardcoded dark theme (does not respect user dark mode preference)
- Resets on button press via `setState({ hasError: false, error: null })`

## Dependencies
- None (self-contained)
