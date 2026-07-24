type Sample = { x: number; y: number; z: number; timestamp: number };

export interface StepDetectorOptions {
  minStepIntervalMs?: number;   // refractory period between counted steps
  maxStepIntervalMs?: number;   // gap larger than this resets the "is walking" streak
  lowPassAlpha?: number;        // gravity-estimate smoothing (0-1, smaller = smoother)
  peakThreshold?: number;       // floor for adaptive threshold, in m/s^2
  minConsecutivePeaks?: number; // peaks needed before we trust it's real walking
  stdDevWindow?: number;        // sample window used for adaptive threshold
}

const DEFAULTS: Required<StepDetectorOptions> = {
  minStepIntervalMs: 300,   // caps at ~3.3 steps/sec (covers running)
  maxStepIntervalMs: 1500,  // gap this long ends the walking streak
  lowPassAlpha: 0.1,
  peakThreshold: 1.2,
  minConsecutivePeaks: 3,
  stdDevWindow: 50,
};

export class StepDetector {
  private opts: Required<StepDetectorOptions>;
  private gravity = { x: 0, y: 0, z: 9.81 };
  private rising = false;
  private lastPeakTime = 0;
  private consecutivePeaks = 0;
  private recentMagnitudes: number[] = [];
  private stepCount = 0;
  private onStep?: (count: number) => void;

  constructor(options: StepDetectorOptions = {}, onStep?: (count: number) => void) {
    this.opts = { ...DEFAULTS, ...options };
    this.onStep = onStep;
  }

  reset() {
    this.stepCount = 0;
    this.consecutivePeaks = 0;
    this.rising = false;
  }

  getCount() {
    return this.stepCount;
  }

  addSample(sample: Sample) {
    const { x, y, z, timestamp } = sample;

    const a = this.opts.lowPassAlpha;
    this.gravity.x = a * x + (1 - a) * this.gravity.x;
    this.gravity.y = a * y + (1 - a) * this.gravity.y;
    this.gravity.z = a * z + (1 - a) * this.gravity.z;

    const linear = {
      x: x - this.gravity.x,
      y: y - this.gravity.y,
      z: z - this.gravity.z,
    };

    const magnitude = Math.sqrt(linear.x ** 2 + linear.y ** 2 + linear.z ** 2);

    this.recentMagnitudes.push(magnitude);
    if (this.recentMagnitudes.length > this.opts.stdDevWindow) {
      this.recentMagnitudes.shift();
    }
    const mean = this.average(this.recentMagnitudes);
    const std = this.stdDev(this.recentMagnitudes, mean);
    const dynamicThreshold = Math.max(this.opts.peakThreshold, mean + std * 0.6);

    const isAbove = magnitude > dynamicThreshold;

    if (isAbove && !this.rising) {
      this.rising = true;
      this.tryRegisterPeak(timestamp);
    } else if (!isAbove && this.rising) {
      this.rising = false;
    }
  }

  private tryRegisterPeak(timestamp: number) {
    const gap = timestamp - this.lastPeakTime;

    if (gap < this.opts.minStepIntervalMs) return;

    if (gap > this.opts.maxStepIntervalMs) {
      this.consecutivePeaks = 0;
    }

    this.consecutivePeaks += 1;
    this.lastPeakTime = timestamp;

    if (this.consecutivePeaks >= this.opts.minConsecutivePeaks) {
      this.stepCount += 1;
      this.onStep?.(this.stepCount);
    }
  }

  private average(arr: number[]) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  private stdDev(arr: number[], mean: number) {
    if (arr.length < 2) return 0;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }
}
