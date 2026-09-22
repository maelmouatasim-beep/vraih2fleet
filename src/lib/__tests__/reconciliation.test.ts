import { describe, it, expect } from 'vitest';
import {
  calculateDeviation,
  getDeviationStatus,
  shouldGenerateAlert,
  getCombinedStatus,
  calculateWeightedDeviation,
  getDefaultConsumption,
  DEFAULT_CONSUMPTION,
} from '../reconciliation';

describe('Reconciliation Calculations', () => {
  describe('calculateDeviation', () => {
    it('should calculate positive deviation when real > predicted', () => {
      expect(calculateDeviation(50000, 40000)).toBe(25);
    });

    it('should calculate negative deviation when real < predicted', () => {
      expect(calculateDeviation(30000, 40000)).toBe(-25);
    });

    it('should return 0 when values are equal', () => {
      expect(calculateDeviation(40000, 40000)).toBe(0);
    });

    it('should return 0 when predicted is 0 (avoid division by zero)', () => {
      expect(calculateDeviation(50000, 0)).toBe(0);
    });

    it('should round to one decimal place', () => {
      expect(calculateDeviation(45123, 40000)).toBe(12.8);
    });

    it('should handle small deviations correctly', () => {
      expect(calculateDeviation(40200, 40000)).toBe(0.5);
    });
  });

  describe('getDeviationStatus', () => {
    it('should return "good" for deviation <= 5%', () => {
      expect(getDeviationStatus(0)).toBe('good');
      expect(getDeviationStatus(3)).toBe('good');
      expect(getDeviationStatus(5)).toBe('good');
      expect(getDeviationStatus(-5)).toBe('good');
    });

    it('should return "warning" for 5% < deviation <= 15%', () => {
      expect(getDeviationStatus(6)).toBe('warning');
      expect(getDeviationStatus(10)).toBe('warning');
      expect(getDeviationStatus(15)).toBe('warning');
      expect(getDeviationStatus(-10)).toBe('warning');
    });

    it('should return "alert" for deviation > 15%', () => {
      expect(getDeviationStatus(16)).toBe('alert');
      expect(getDeviationStatus(25)).toBe('alert');
      expect(getDeviationStatus(100)).toBe('alert');
      expect(getDeviationStatus(-20)).toBe('alert');
    });
  });

  describe('shouldGenerateAlert', () => {
    it('should return true for deviation > 15%', () => {
      expect(shouldGenerateAlert(16)).toBe(true);
      expect(shouldGenerateAlert(-20)).toBe(true);
    });

    it('should return false for deviation <= 15%', () => {
      expect(shouldGenerateAlert(15)).toBe(false);
      expect(shouldGenerateAlert(10)).toBe(false);
      expect(shouldGenerateAlert(0)).toBe(false);
    });
  });

  describe('getCombinedStatus', () => {
    it('should return "alert" if either deviation is alert level', () => {
      expect(getCombinedStatus(20, 5)).toBe('alert');
      expect(getCombinedStatus(5, 20)).toBe('alert');
      expect(getCombinedStatus(20, 20)).toBe('alert');
    });

    it('should return "warning" if highest is warning level', () => {
      expect(getCombinedStatus(10, 3)).toBe('warning');
      expect(getCombinedStatus(3, 10)).toBe('warning');
      expect(getCombinedStatus(10, 10)).toBe('warning');
    });

    it('should return "good" if both are good', () => {
      expect(getCombinedStatus(3, 3)).toBe('good');
      expect(getCombinedStatus(0, 5)).toBe('good');
    });
  });

  describe('calculateWeightedDeviation', () => {
    it('should calculate weighted average correctly', () => {
      const items = [
        { deviation: 10, count: 5 },
        { deviation: 20, count: 5 },
      ];
      expect(calculateWeightedDeviation(items)).toBe(15);
    });

    it('should weight by count correctly', () => {
      const items = [
        { deviation: 10, count: 9 },
        { deviation: 100, count: 1 },
      ];
      expect(calculateWeightedDeviation(items)).toBe(19);
    });

    it('should return 0 for empty array', () => {
      expect(calculateWeightedDeviation([])).toBe(0);
    });

    it('should return 0 if total count is 0', () => {
      const items = [
        { deviation: 10, count: 0 },
        { deviation: 20, count: 0 },
      ];
      expect(calculateWeightedDeviation(items)).toBe(0);
    });
  });

  describe('getDefaultConsumption', () => {
    it('should return correct consumption for known vehicle types', () => {
      expect(getDefaultConsumption('Light Van')).toBe(15);
      expect(getDefaultConsumption('Medium Truck')).toBe(25);
      expect(getDefaultConsumption('Heavy Truck')).toBe(35);
    });

    it('should return default for unknown vehicle types', () => {
      expect(getDefaultConsumption('Unknown Type')).toBe(25);
      expect(getDefaultConsumption('')).toBe(25);
    });
  });

  describe('DEFAULT_CONSUMPTION constant', () => {
    it('should have expected values', () => {
      expect(DEFAULT_CONSUMPTION['Light Van']).toBe(15);
      expect(DEFAULT_CONSUMPTION['Medium Truck']).toBe(25);
      expect(DEFAULT_CONSUMPTION['Heavy Truck']).toBe(35);
      expect(DEFAULT_CONSUMPTION.default).toBe(25);
    });
  });
});

describe('Reconciliation Alert Generation', () => {
  it('should generate alerts for multiple vehicle types with significant deviations', () => {
    const items = [
      { vehicleType: 'Heavy Truck', kmDeviation: 18, consumptionDeviation: 5 },
      { vehicleType: 'Medium Truck', kmDeviation: 3, consumptionDeviation: 22 },
      { vehicleType: 'Light Van', kmDeviation: 5, consumptionDeviation: 5 },
    ];

    const alerts = items.flatMap((item) => {
      const result: Array<{ type: string; vehicleType: string }> = [];
      if (shouldGenerateAlert(item.kmDeviation)) {
        result.push({ type: 'km', vehicleType: item.vehicleType });
      }
      if (shouldGenerateAlert(item.consumptionDeviation)) {
        result.push({ type: 'consumption', vehicleType: item.vehicleType });
      }
      return result;
    });

    expect(alerts).toHaveLength(2);
    expect(alerts).toContainEqual({ type: 'km', vehicleType: 'Heavy Truck' });
    expect(alerts).toContainEqual({ type: 'consumption', vehicleType: 'Medium Truck' });
  });
});
