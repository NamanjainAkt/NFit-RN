import { calculateCalories, calculateDistance } from '../calculations';

describe('calculateCalories', () => {
  it('calculates calories with metric units', () => {
    expect(calculateCalories(10000, 70, true)).toBe(350);
  });

  it('calculates calories with imperial units', () => {
    expect(calculateCalories(10000, 154, false)).toBe(349);
  });

  it('returns 0 for 0 steps', () => {
    expect(calculateCalories(0, 70, true)).toBe(0);
  });
});

describe('calculateDistance', () => {
  it('calculates distance in km with metric units', () => {
    const result = calculateDistance(10000, 170, true);
    expect(result).toBeCloseTo(7.055, 2);
  });

  it('calculates distance in miles with imperial units', () => {
    const result = calculateDistance(10000, 67, false);
    expect(result).toBeCloseTo(4.388, 2);
  });
});
