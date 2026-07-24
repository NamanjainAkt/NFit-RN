import { createStepFilterState, processStepDelta } from '../stepFilter';

describe('processStepDelta - Robust Step & Shake Filter', () => {
  it('should ignore isolated small shakes (1-3 steps) when motion stops', () => {
    let state = createStepFilterState();
    let now = 1000;

    // Small shake: 2 steps
    let res = processStepDelta(state, 2, now);
    state = res.newState;
    expect(res.acceptedDelta).toBe(0);

    // Pause for 3 seconds (> 2.0s cadence window)
    now += 3000;

    // Another small shake: 2 steps (total raw = 4)
    res = processStepDelta(state, 4, now);
    state = res.newState;

    // Previous 2 pending steps are discarded, new 2 steps are pending
    expect(res.acceptedDelta).toBe(0);
    expect(state.pendingSteps).toBe(2);
    expect(state.acceptedSteps).toBe(0);
  });

  it('should credit all steps once continuous walking reaches minimum burst (12 steps)', () => {
    let state = createStepFilterState();
    let now = 1000;

    // Step update 1: 5 steps at timestamp 1000
    let res = processStepDelta(state, 5, now);
    state = res.newState;
    expect(res.acceptedDelta).toBe(0);

    // Step update 2: 7 steps 1000ms later at timestamp 2000 (total raw = 12)
    now += 1000;
    res = processStepDelta(state, 12, now);
    state = res.newState;

    // 12 steps reached within cadence! Flush initial burst
    expect(res.acceptedDelta).toBe(12);
    expect(state.acceptedSteps).toBe(12);
    expect(state.isBurstActive).toBe(true);

    // Step update 3: 5 continuous steps 1000ms later (total raw = 17)
    now += 1000;
    res = processStepDelta(state, 17, now);
    state = res.newState;

    // Active burst continues step-by-step
    expect(res.acceptedDelta).toBe(5);
    expect(state.acceptedSteps).toBe(17);
  });

  it('should reject violent shake spoofing (> 4 steps/sec)', () => {
    let state = createStepFilterState();
    let now = 1000;

    // Initialize baseline at 1000ms
    state = processStepDelta(state, 1, now).newState;

    // Violent shake: 15 steps in 200ms
    now += 200;
    const res = processStepDelta(state, 16, now);
    expect(res.acceptedDelta).toBe(0);
    expect(res.newState.acceptedSteps).toBe(0);
  });
});
