import { describe, it, expect } from 'vitest';
import { calculateTCO } from '../tco';
import { calculateResidualValue } from '../capex';
import { Scenario, ReferenceData, DEFAULT_REFERENCE_DATA } from '../types';

// Base test scenario factory
function createBaseScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test-scenario-1',
    projectId: 'test-project',
    name: 'Test Scenario',
    region: 'Canada',
    analysisYears: 10,
    discountRate: 5,
    fleetComposition: {
      diesel: { count: 5, annualKm: 80000 },
      ev: { count: 5, annualKm: 80000 },
      hydrogen: { count: 0, annualKm: 0 },
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Reference data for tests
const testReferenceData: ReferenceData = {
  ...DEFAULT_REFERENCE_DATA,
  diesel_truck: 150000,
  ev_truck: 280000,
  hydrogen_truck: 350000,
  diesel_price: 1.50,
  electricity_price: 0.12,
  hydrogen_price: 12.00,
  maintenance_diesel: 15000,
  maintenance_ev: 8000,
  maintenance_hydrogen: 10000,
};

describe('TCO Calculation - Vehicle Life Years Parameter', () => {
  it('should use default 12-year life when vehicleLifeYears is not provided', () => {
    const scenario = createBaseScenario();
    const result = calculateTCO(scenario, testReferenceData);
    
    // With 10-year analysis and 12-year life: residual should be ~(1 - 10/12) = 16.67% of CAPEX
    // Plus 10% floor protection
    const expectedMinResidual = result.capex * 0.10;
    const expectedMaxResidual = result.capex * 0.20;
    
    expect(result.residualValue).toBeGreaterThanOrEqual(expectedMinResidual);
    expect(result.residualValue).toBeLessThanOrEqual(expectedMaxResidual);
  });

  it('should use provided vehicleLifeYears in residual value calculation', () => {
    // Create scenario with explicit vehicle life of 15 years
    const scenarioWith15YearLife = createBaseScenario({
      fleetComposition: {
        diesel: { count: 5, annualKm: 80000 },
        ev: { count: 5, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
        // @ts-ignore - adding vehicleParams for test
      },
    });
    
    // Add vehicleParams with lifeYears
    (scenarioWith15YearLife.fleetComposition as any).vehicleParams = {
      lifeYears: 15,
    };
    
    const resultWith15Year = calculateTCO(scenarioWith15YearLife, testReferenceData);
    
    // Create scenario with 8-year life
    const scenarioWith8YearLife = createBaseScenario();
    (scenarioWith8YearLife.fleetComposition as any).vehicleParams = {
      lifeYears: 8,
    };
    
    const resultWith8Year = calculateTCO(scenarioWith8YearLife, testReferenceData);
    
    // With longer vehicle life (15y), more residual value remains after 10 years
    // With shorter vehicle life (8y), vehicle is almost fully depreciated after 10 years
    expect(resultWith15Year.residualValue).toBeGreaterThan(resultWith8Year.residualValue);
  });

  it('should cap depreciation at 90% (10% floor residual)', () => {
    const scenario = createBaseScenario({
      analysisYears: 20, // Very long analysis
    });
    (scenario.fleetComposition as any).vehicleParams = {
      lifeYears: 10, // Short life means full depreciation
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Residual should be at least 10% of CAPEX
    const minExpectedResidual = result.capex * 0.10;
    expect(result.residualValue).toBeGreaterThanOrEqual(minExpectedResidual);
  });
});

describe('TCO Calculation - Residual Value Percent Parameter', () => {
  it('should use provided residualValuePercent over calculated depreciation', () => {
    const scenario = createBaseScenario();
    
    // Set explicit 25% residual value
    (scenario.fleetComposition as any).vehicleParams = {
      residualValuePercent: 25,
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Residual should be exactly 25% of CAPEX
    const expectedResidual = result.capex * 0.25;
    expect(result.residualValue).toBeCloseTo(expectedResidual, 0);
  });

  it('should respect 0% residual value when explicitly set', () => {
    const scenario = createBaseScenario();
    
    // Set explicit 0% residual value
    (scenario.fleetComposition as any).vehicleParams = {
      residualValuePercent: 0,
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    
    expect(result.residualValue).toBe(0);
  });

  it('should prioritize residualValuePercent over lifeYears calculation', () => {
    const scenario = createBaseScenario();
    
    // Set both - residualValuePercent should win
    (scenario.fleetComposition as any).vehicleParams = {
      residualValuePercent: 40,
      lifeYears: 8, // Would give different result if used
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Should be 40% regardless of lifeYears
    const expectedResidual = result.capex * 0.40;
    expect(result.residualValue).toBeCloseTo(expectedResidual, 0);
  });
});

describe('TCO Calculation - Infrastructure Cost Per Vehicle Parameter', () => {
  it('should use custom infrastructure cost when enabled', () => {
    const scenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 10, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    const customCostPerVehicle = 25000;
    (scenario.fleetComposition as any).vehicleParams = {
      customInfraEnabled: true,
      customInfraCostPerVehicle: customCostPerVehicle,
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Total infrastructure cost should be 10 vehicles × $25,000 = $250,000
    expect(result.totalInfrastructureCost).toBe(250000);
  });

  it('should calculate infrastructure automatically when customInfraEnabled is false', () => {
    const scenarioWithoutCustom = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 10, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    const scenarioWithCustom = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 10, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    (scenarioWithCustom.fleetComposition as any).vehicleParams = {
      customInfraEnabled: true,
      customInfraCostPerVehicle: 50000,
    };
    
    const resultWithoutCustom = calculateTCO(scenarioWithoutCustom, testReferenceData);
    const resultWithCustom = calculateTCO(scenarioWithCustom, testReferenceData);
    
    // Custom should give exactly $500,000, auto-calculated will differ
    expect(resultWithCustom.totalInfrastructureCost).toBe(500000);
    expect(resultWithoutCustom.totalInfrastructureCost).not.toBe(500000);
  });

  it('should not override infrastructure when customInfraEnabled is false', () => {
    const scenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 10, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    // Set cost but don't enable - should be ignored
    (scenario.fleetComposition as any).vehicleParams = {
      customInfraEnabled: false,
      customInfraCostPerVehicle: 100000,
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Should NOT be 10 × $100,000 = $1,000,000
    expect(result.totalInfrastructureCost).not.toBe(1000000);
  });

  it('should include all vehicle types in infrastructure cost calculation', () => {
    const scenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 5, annualKm: 80000 },
        ev: { count: 10, annualKm: 80000 },
        hydrogen: { count: 5, annualKm: 80000 },
      },
    });
    
    const customCostPerVehicle = 20000;
    (scenario.fleetComposition as any).vehicleParams = {
      customInfraEnabled: true,
      customInfraCostPerVehicle: customCostPerVehicle,
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Total: (5 + 10 + 5) = 20 vehicles × $20,000 = $400,000
    expect(result.totalInfrastructureCost).toBe(400000);
  });
});

describe('TCO Calculation - Parameter Impact on TCO Total', () => {
  it('should reduce TCO when residual value is higher', () => {
    const baseScenario = createBaseScenario();
    const highResidualScenario = createBaseScenario();
    
    (highResidualScenario.fleetComposition as any).vehicleParams = {
      residualValuePercent: 40, // High residual
    };
    
    const baseResult = calculateTCO(baseScenario, testReferenceData);
    const highResidualResult = calculateTCO(highResidualScenario, testReferenceData);
    
    // Higher residual value should reduce TCO
    expect(highResidualResult.tcoTotal).toBeLessThan(baseResult.tcoTotal);
  });

  it('should increase TCO when infrastructure cost is higher', () => {
    const baseScenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 10, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    const highInfraScenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 10, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    (highInfraScenario.fleetComposition as any).vehicleParams = {
      customInfraEnabled: true,
      customInfraCostPerVehicle: 100000, // Very high infrastructure cost
    };
    
    const baseResult = calculateTCO(baseScenario, testReferenceData);
    const highInfraResult = calculateTCO(highInfraScenario, testReferenceData);
    
    // Higher infrastructure cost should increase TCO
    expect(highInfraResult.tcoTotal).toBeGreaterThan(baseResult.tcoTotal);
  });
});

describe('calculateResidualValue Unit Function', () => {
  const testCapex = 1000000;
  
  it('should calculate residual based on linear depreciation by default', () => {
    const analysisYears = 10;
    const lifeYears = 12;
    
    const residual = calculateResidualValue(testCapex, analysisYears, undefined, lifeYears);
    
    // 10/12 = 83.33% depreciated, so ~16.67% residual
    const expectedResidual = testCapex * (1 - 10 / 12);
    expect(residual).toBeCloseTo(expectedResidual, 0);
  });
  
  it('should use residualValuePercent when provided', () => {
    const analysisYears = 10;
    const residualPercent = 30;
    
    const residual = calculateResidualValue(testCapex, analysisYears, residualPercent, 12);
    
    expect(residual).toBe(testCapex * 0.30);
  });
  
  it('should enforce 10% floor on depreciation', () => {
    const analysisYears = 20; // Longer than typical life
    const lifeYears = 10;
    
    const residual = calculateResidualValue(testCapex, analysisYears, undefined, lifeYears);
    
    // Should be at minimum 10% (floor)
    expect(residual).toBe(testCapex * 0.10);
  });
  
  it('should allow 0% residual when explicitly set', () => {
    const analysisYears = 10;
    const residualPercent = 0;
    
    const residual = calculateResidualValue(testCapex, analysisYears, residualPercent, 12);
    
    expect(residual).toBe(0);
  });
  
  it('should use default 12-year life when not specified', () => {
    const analysisYears = 6;
    
    const residual = calculateResidualValue(testCapex, analysisYears);
    
    // 6/12 = 50% depreciated, so 50% residual
    const expectedResidual = testCapex * 0.50;
    expect(residual).toBeCloseTo(expectedResidual, 0);
  });
});

describe('TCO Calculation - Edge Cases', () => {
  it('should handle zero vehicles correctly', () => {
    const scenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 0, annualKm: 0 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    const result = calculateTCO(scenario, testReferenceData);
    
    expect(result.capex).toBe(0);
    expect(result.opexTotal).toBe(0);
    expect(result.residualValue).toBe(0);
  });

  it('should handle very short analysis period', () => {
    const scenario = createBaseScenario({
      analysisYears: 1,
    });
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Should still calculate meaningful results
    expect(result.tcoTotal).toBeGreaterThan(0);
    expect(result.yearlyBreakdown).toHaveLength(1);
  });

  it('should handle very long analysis period', () => {
    const scenario = createBaseScenario({
      analysisYears: 25,
    });
    
    const result = calculateTCO(scenario, testReferenceData);
    
    // Residual should be at floor (10%)
    expect(result.residualValue).toBeGreaterThanOrEqual(result.capex * 0.10);
    expect(result.yearlyBreakdown).toHaveLength(25);
  });
});

describe('TCO Calculation - Hydrogen Inflation', () => {
  it('should handle negative H2 inflation (price decrease over time)', () => {
    const scenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 0, annualKm: 0 },
        hydrogen: { count: 10, annualKm: 80000 },
      },
    });
    
    (scenario.fleetComposition as any).vehicleParams = {
      h2Params: {
        h2InflationEnabled: true,
        h2InflationRate: -5,
      },
    };
    
    const result = calculateTCO(scenario, testReferenceData);
    expect(result.tcoTotal).toBeGreaterThan(0);
    expect(result.opexTotal).toBeGreaterThan(0);
  });

  it('should produce lower OPEX with negative H2 inflation vs positive', () => {
    const positiveScenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 0, annualKm: 0 },
        hydrogen: { count: 10, annualKm: 80000 },
      },
    });
    (positiveScenario.fleetComposition as any).vehicleParams = {
      h2Params: { h2InflationEnabled: true, h2InflationRate: 5 },
    };
    
    const negativeScenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 0, annualKm: 0 },
        hydrogen: { count: 10, annualKm: 80000 },
      },
    });
    (negativeScenario.fleetComposition as any).vehicleParams = {
      h2Params: { h2InflationEnabled: true, h2InflationRate: -5 },
    };
    
    const resultPositive = calculateTCO(positiveScenario, testReferenceData);
    const resultNegative = calculateTCO(negativeScenario, testReferenceData);
    
    expect(resultNegative.opexTotal).toBeLessThan(resultPositive.opexTotal);
  });
});
