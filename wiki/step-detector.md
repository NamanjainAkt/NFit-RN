# StepDetector

> `utils/stepDetector.ts` | Accelerometer-based step detection using adaptive threshold

## Purpose
Robust step detection from raw accelerometer data. Uses a low-pass filter to estimate gravity, extracts linear acceleration, and applies adaptive peak detection with a refractory period.

## Algorithm
1. **Gravity estimation**: Exponential moving average (alpha=0.1) over raw x/y/z
2. **Linear acceleration**: Raw − gravity, then compute magnitude
3. **Adaptive threshold**: `max(peakThreshold, mean + 0.6 * stddev)` over a 50-sample window
4. **Peak detection**: Rising edge crosses threshold → potential step
5. **Refractory**: 300ms min interval between counted steps
6. **Consecutive check**: 3 peaks required before counting begins (avoids false starts)
7. **Timeout**: 1500ms gap resets the consecutive peak counter

## Usage
```typescript
const detector = new StepDetector({}, (count) => {
  // count is the running total of detected steps
});
// Feed accelerometer samples (in m/s^2):
detector.addSample({ x, y, z, timestamp });
```

## Key Parameters
| Param | Default | Description |
|-------|---------|-------------|
| `minStepIntervalMs` | 300 | Refractory period between steps (~3.3 steps/sec max) |
| `maxStepIntervalMs` | 1500 | Gap resets consecutive peak streak |
| `lowPassAlpha` | 0.1 | Gravity EMA smoothing |
| `peakThreshold` | 1.2 m/s² | Minimum floor for adaptive threshold |
| `minConsecutivePeaks` | 3 | Peaks before committing a step |
| `stdDevWindow` | 50 | Rolling window for adaptive threshold |

## Dependencies
- `expo-sensors` — Accelerometer (called from [[use-step-tracker]])
