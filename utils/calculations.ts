export function calculateCalories(steps: number, weight: number, useMetric: boolean): number {
  const weightKg = useMetric ? weight : weight * 0.453592;
  return Math.round(steps * weightKg * 0.0005);
}

export function calculateDistance(steps: number, height: number, useMetric: boolean): number {
  const stride = height * 0.415;
  return useMetric
    ? steps * stride / 100000
    : steps * stride / 63360;
}
