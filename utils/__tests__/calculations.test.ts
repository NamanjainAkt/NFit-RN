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

  it('returns 0 for 0 weight', () => {
    expect(calculateCalories(10000, 0, true)).toBe(0);
  });

  it('handles very heavy weight', () => {
    expect(calculateCalories(10000, 200, true)).toBe(1000);
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

  it('returns 0 for 0 steps', () => {
    expect(calculateDistance(0, 170, true)).toBe(0);
  });

  it('handles very tall height', () => {
    const result = calculateDistance(10000, 220, true);
    expect(result).toBeGreaterThan(0);
  });

  it('handles very short height', () => {
    const result = calculateDistance(10000, 100, true);
    expect(result).toBeGreaterThan(0);
  });
});
