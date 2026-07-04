const noop = async () => {};
const noopFalse = async () => false;
const noopZero = async () => 0;
const noopTrue = async () => true;

export default {
  startService: noop,
  stopService: noop,
  getAccumulatedSteps: noopZero,
  isServiceRunning: noopFalse,
  resetForNewDay: noop,
  isIgnoringBatteryOptimizations: noopFalse,
  requestIgnoreBatteryOptimizations: noop,
  setBackgroundTrackingEnabled: noop,
  isBackgroundTrackingEnabled: noopTrue,
};
