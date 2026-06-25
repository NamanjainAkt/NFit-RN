import type { NativeModule } from 'expo';

export interface BackgroundStepsModuleNative extends NativeModule {
  startService(): Promise<void>;
  stopService(): Promise<void>;
  getAccumulatedSteps(): Promise<number>;
  isServiceRunning(): Promise<boolean>;
  resetForNewDay(): Promise<void>;
}

export type StepsUpdateEvent = {
  steps: number;
};
