import type { NativeModule } from 'expo';

export interface BackgroundStepsModuleNative extends NativeModule {
  startService(): Promise<void>;
  stopService(): Promise<void>;
  getAccumulatedSteps(): Promise<number>;
  isServiceRunning(): Promise<boolean>;
  resetForNewDay(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  setBackgroundTrackingEnabled(enabled: boolean): Promise<void>;
  isBackgroundTrackingEnabled(): Promise<boolean>;
}

export type StepsUpdateEvent = {
  steps: number;
};
