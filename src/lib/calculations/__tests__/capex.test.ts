import { describe, it, expect } from 'vitest';
import { calculateCapex, calculateResidualValue } from '../capex';
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

const testReferenceData: ReferenceData = {
  ...DEFAULT_REFERENCE_DATA,
  diesel_truck: 150000,
  ev_truck: 280000,
  hydrogen_truck: 350000,
};

describe('calculateCapex', () => {
  it('should calculate CAPEX based on vehicle counts', () => {
    const scenario = createBaseScenario();
    
    const result = calculateCapex(scenario, testReferenceData);
    
    // 5 diesel × $150k + 5 EV × $280k = $750k + $1,400k = $2,150k
    expect(result.total).toBe(2150000);
    expect(result.byType.diesel.capex).toBe(750000);
    expect(result.byType.ev.capex).toBe(1400000);
    expect(result.byType.hydrogen.capex).toBe(0);
  });

  it('should handle hydrogen vehicles', () => {
    const scenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 2, annualKm: 80000 },
        ev: { count: 3, annualKm: 80000 },
        hydrogen: { count: 5, annualKm: 80000 },
      },
    });
    
    const result = calculateCapex(scenario, testReferenceData);
    
    // 2 diesel × $150k + 3 EV × $280k + 5 H2 × $350k = $300k + $840k + $1,750k = $2,890k
    expect(result.total).toBe(2890000);
    expect(result.byType.diesel.capex).toBe(300000);
    expect(result.byType.ev.capex).toBe(840000);
    expect(result.byType.hydrogen.capex).toBe(1750000);
  });

  it('should use custom vehicle prices from configuration', () => {
    const scenario = createBaseScenario({
      vehicleConfiguration: {
        category: 'rigid_truck',
        currentPowertrain: 'diesel',
        targetPowertrains: ['bev'],
        targetPowertrainMix: { diesel: 50, bev: 50, fcev: 0, phev: 0, biomethane: 0 },
        annualKm: 80000,
        tripType: 'urban',
        minAutonomy: 200,
        chargingTime: 'night_8h',
        loadProfile: 'medium',
        vehicleCount: 10,
        minTemperature: '-10',
        maxTemperature: '35',
        terrainTypes: ['flat'],
        currentVehiclePrice: 100000, // Custom diesel price
        alternativeVehiclePrice: 200000, // Custom EV price
        currentConsumption: 35,
        annualMaintenanceCost: 12000,
        electricityPrice: 0.12,
        dieselPrice: 1.50,
        vehiclePrices: {
          diesel: 100000,
          bev: 200000,
        },
      },
      fleetComposition: {
        diesel: { count: 5, annualKm: 80000 },
        ev: { count: 5, annualKm: 80000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    const result = calculateCapex(scenario, testReferenceData);
    
    // Should use custom prices: 5 × $100k + 5 × $200k = $500k + $1,000k = $1,500k
    expect(result.total).toBe(1500000);
  });

  it('should handle zero vehicles', () => {
    const scenario = createBaseScenario({
      fleetComposition: {
        diesel: { count: 0, annualKm: 0 },
        ev: { count: 0, annualKm: 0 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    });
    
    const result = calculateCapex(scenario, testReferenceData);
    
    expect(result.total).toBe(0);
  });
});

describe('calculateResidualValue', () => {
  describe('with user-provided residualValuePercent', () => {
    it('should use exact percentage when provided', () => {
      const capex = 1000000;
      const residualPercent = 25;
      
      const result = calculateResidualValue(capex, 10, residualPercent);
      
      expect(result).toBe(250000);
    });

    it('should allow 0% residual value', () => {
      const capex = 1000000;
      
      const result = calculateResidualValue(capex, 10, 0);
      
      expect(result).toBe(0);
    });

    it('should allow high residual percentages', () => {
      const capex = 1000000;
      
      const result = calculateResidualValue(capex, 10, 50);
      
      expect(result).toBe(500000);
    });
  });

  describe('with depreciation calculation', () => {
    it('should use linear depreciation with default 12-year life', () => {
      const capex = 1200000;
      const analysisYears = 6;
      
      const result = calculateResidualValue(capex, analysisYears);
      
      // 6/12 = 50% depreciated → 50% residual
      expect(result).toBe(600000);
    });

    it('should use custom lifeYears for depreciation', () => {
      const capex = 1000000;
      const analysisYears = 5;
      const lifeYears = 10;
      
      const result = calculateResidualValue(capex, analysisYears, undefined, lifeYears);
      
      // 5/10 = 50% depreciated → 50% residual
      expect(result).toBe(500000);
    });

    it('should enforce 10% floor on residual value', () => {
      const capex = 1000000;
      const analysisYears = 15;
      const lifeYears = 10;
      
      const result = calculateResidualValue(capex, analysisYears, undefined, lifeYears);
      
      // Would be 150% depreciated, but floor is 10%
      expect(result).toBe(100000);
    });

    it('should cap depreciation at 90%', () => {
      const capex = 1000000;
      const analysisYears = 20;
      const lifeYears = 12;
      
      const result = calculateResidualValue(capex, analysisYears, undefined, lifeYears);
      
      // 20/12 = 166% depreciated, capped at 90% → 10% residual
      expect(result).toBe(100000);
    });
  });

  describe('priority of parameters', () => {
    it('should prioritize residualValuePercent over lifeYears', () => {
      const capex = 1000000;
      const analysisYears = 10;
      const residualPercent = 35;
      const lifeYears = 8; // Would give different result
      
      const result = calculateResidualValue(capex, analysisYears, residualPercent, lifeYears);
      
      // Should use 35% regardless of lifeYears calculation
      expect(result).toBe(350000);
    });

    it('should use lifeYears when residualValuePercent is undefined', () => {
      const capex = 1000000;
      const analysisYears = 5;
      const lifeYears = 20;
      
      const result = calculateResidualValue(capex, analysisYears, undefined, lifeYears);
      
      // 5/20 = 25% depreciated → 75% residual
      expect(result).toBe(750000);
    });
  });

  describe('edge cases', () => {
    it('should handle zero CAPEX', () => {
      const result = calculateResidualValue(0, 10, 25);
      
      expect(result).toBe(0);
    });

    it('should handle single year analysis', () => {
      const capex = 1200000;
      
      const result = calculateResidualValue(capex, 1);
      
      // 1/12 = 8.33% depreciated → 91.67% residual
      expect(result).toBeCloseTo(1100000, 0);
    });

    it('should handle very short vehicle life', () => {
      const capex = 1000000;
      const analysisYears = 10;
      const lifeYears = 5;
      
      const result = calculateResidualValue(capex, analysisYears, undefined, lifeYears);
      
      // 10/5 = 200% depreciated, capped at 90% → 10% residual
      expect(result).toBe(100000);
    });
  });
});
