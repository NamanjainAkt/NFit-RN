const noop = async () => {};
const noopFalse = async () => false;
const noopZero = async () => 0;

export default {
  startService: noop,
  stopService: noop,
  getAccumulatedSteps: noopZero,
  isServiceRunning: noopFalse,
  resetForNewDay: noop,
};
