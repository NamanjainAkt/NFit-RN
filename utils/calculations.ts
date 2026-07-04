export function calculateCalories(steps: number, weight: number, useMetric: boolean): number {
  const weightKg = useMetric ? weight : weight * 0.453592;
  return Math.round(steps * weightKg * 0.0005);
}

export function calculateDistance(steps: number, height: number, useMetric: boolean): number {
  // height is always stored in the user's chosen unit.
  // Normalize to cm for a consistent stride calculation (stride = height_cm * 0.415 cm).
  const heightCm = useMetric ? height : height * 2.54;
  const strideCm = heightCm * 0.415;
  const distanceM = steps * strideCm / 100;
  return useMetric ? distanceM / 1000 : distanceM / 1609.344;
}
