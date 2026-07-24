/**
 * Step Cadence & Burst Filter
 * Filters out isolated phone shakes, handling vibrations, and unrealistic rapid movements.
 *
 * Rules:
 * 1. Step rate cap: Max 4 steps/sec (faster rate discarded as violent shake spoofing).
 * 2. Cadence window: 2500ms max gap between step updates. If gap > 2500ms, a new session starts.
 * 3. Min burst: 5 steps required within a continuous walking session before committing.
 * 4. Once min burst is achieved, all buffered steps + subsequent continuous steps are accepted.
 */

export interface StepFilterState {
  pendingSteps: number;
  acceptedSteps: number;
  lastTimestamp: number;
  isBurstActive: boolean;
}

export function createStepFilterState(): StepFilterState {
  return {
    pendingSteps: 0,
    acceptedSteps: 0,
    lastTimestamp: 0,
    isBurstActive: false,
  };
}

export function processStepDelta(
  state: StepFilterState,
  rawStepsSinceSub: number,
  now: number = Date.now(),
  minBurstSteps: number = 12,
  maxCadenceMs: number = 2000,
  maxStepsPerSec: number = 4
): { newState: StepFilterState; acceptedDelta: number } {
  // If state is fresh, record initial timestamp
  if (state.lastTimestamp === 0) {
    state = { ...state, lastTimestamp: now };
  }

  // If rawStepsSinceSub hasn't increased, no delta to process
  if (rawStepsSinceSub <= state.acceptedSteps + state.pendingSteps) {
    return { newState: state, acceptedDelta: 0 };
  }

  const delta = rawStepsSinceSub - (state.acceptedSteps + state.pendingSteps);
  const timeElapsedMs = now - state.lastTimestamp;

  // Sanity check: prevent unrealistic rapid step rate (e.g. violent shaking > 5 steps/sec)
  if (timeElapsedMs > 0 && timeElapsedMs < 1000) {
    const stepsPerSec = (delta * 1000) / timeElapsedMs;
    if (stepsPerSec > maxStepsPerSec) {
      // Discard violent shake burst
      return { newState: state, acceptedDelta: 0 };
    }
  }

  let pendingSteps = state.pendingSteps;
  let isBurstActive = state.isBurstActive;
  let acceptedSteps = state.acceptedSteps;
  let acceptedDelta = 0;

  // Check if cadence window expired (user paused or stopped for > 2.5s)
  if (timeElapsedMs > maxCadenceMs) {
    // Gap exceeded: reset pending unverified steps (discarding previous isolated shake)
    pendingSteps = 0;
    isBurstActive = false;
  }

  pendingSteps += delta;

  if (isBurstActive) {
    // Already in active walking burst: immediately accept new steps
    acceptedDelta = pendingSteps;
    acceptedSteps += pendingSteps;
    pendingSteps = 0;
  } else if (pendingSteps >= minBurstSteps) {
    // Threshold reached! Flush initial burst (e.g. 5 steps) and mark burst active
    isBurstActive = true;
    acceptedDelta = pendingSteps;
    acceptedSteps += pendingSteps;
    pendingSteps = 0;
  }

  return {
    newState: {
      pendingSteps,
      acceptedSteps,
      lastTimestamp: now,
      isBurstActive,
    },
    acceptedDelta,
  };
}
