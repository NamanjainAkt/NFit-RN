# stepFilter

> `utils/stepFilter.ts` | Step Cadence & Burst Filter

## Purpose
Provides a robust step filtering utility to eliminate false step increments from phone shaking, handling vibrations, and rapid manual spoofing.

## Key Behavior
1. **Cadence Window**: 2500ms maximum gap between step increments. If time gap exceeds 2500ms, any pending unverified steps from a prior movement are discarded and a new session starts.
2. **Minimum Burst Threshold**: Requires a minimum burst of 5 steps within the cadence window before committing any steps.
3. **Step Rate Cap**: Max 5 steps/second allowed. Faster rates are discarded as violent shake spoofing.
4. **Seamless Walk Commit**: Once 5 continuous steps are reached, all 5 steps + all subsequent contiguous walking steps are credited instantly with 0 step loss.

## Functions
- `createStepFilterState(): StepFilterState` — Creates initial filter state
- `processStepDelta(state, rawStepsSinceSub, now, minBurstSteps, maxCadenceMs, maxStepsPerSec)` — Processes raw pedometer step counts and returns `{ newState, acceptedDelta }`

## Dependencies
- [[use-step-tracker]] — Consumes `processStepDelta` inside `Pedometer.watchStepCount`
