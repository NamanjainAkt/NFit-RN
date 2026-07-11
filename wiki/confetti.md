# Confetti Component

> `components/Confetti.tsx` | Goal celebration animation

## Purpose
Renders 60 animated particles that fall from the top of the screen with rotation and fade-out. Triggered when the user reaches their daily step goal.

## Animation Details
- 60 particles with random x position, size (4-14px), color (9-color palette)
- Y translation: falls to `H + 50` over 3.5-6s
- Rotation: random left/right spin over 2s
- Opacity: fades to 0 after 2.5-4s delay, over 500ms
- All animations run in parallel, using native driver

## Usage
```typescript
{confettiKey > 0 && <Confetti key={confettiKey} />}
```
`confettiKey` increments on each goal achievement to remount the component.

## Dependencies
- `react-native` — `Animated`, `Dimensions`
