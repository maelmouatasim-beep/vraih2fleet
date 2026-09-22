/**
 * H2Fleet Planner - TCO Calculation Engine
 * 
 * Pure functions for computing Total Cost of Ownership, emissions,
 * and energy demand for fleet transition scenarios.
 */

import type {
  VehicleGroup,
  Scenario,
  ScenarioVehicleGroupConfig,
  YearlyResult,
  ScenarioResults,
  TargetPowertrain,
} from '@/types';

// Infrastructure parameters (can be made configurable)
const INFRA_PARAMS = {
  h2StationCapacityKgPerDay: 1000,
  evChargerPowerKw: 150,
  avgHoursOperationPerDay: 16,
  daysPerYear: 300, // working days
};

interface CalculationInput {
  scenario: Scenario;
  vehicleGroups: VehicleGroup[];
  configs: ScenarioVehicleGroupConfig[];
  baselineScenarioResults?: ScenarioResults; // For CO2 comparison
}

/**
 * Calculate NPV (Net Present Value) of a cash flow series
 */
function calculateNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((npv, cf, year) => {
    return npv + cf / Math.pow(1 + discountRate, year);
  }, 0);
}

/**
 * Get the config for a vehicle group in a scenario
 */
function getConfigForGroup(
  vehicleGroupId: string,
  configs: ScenarioVehicleGroupConfig[]
): ScenarioVehicleGroupConfig | undefined {
  return configs.find(c => c.vehicleGroupId === vehicleGroupId);
}

/**
 * Calculate annual fuel/energy cost for a vehicle group
 */
function calculateAnnualEnergyCost(
  group: VehicleGroup,
  config: ScenarioVehicleGroupConfig | undefined,
  powertrain: TargetPowertrain,
  vehicleCount: number
): { cost: number; h2Kg: number; kwh: number; dieselL: number } {
  const totalKm = vehicleCount * group.avgKmPerYear;
  
  if (powertrain === 'keep_diesel' || !config) {
    // Diesel calculation
    const dieselL = (totalKm / 100) * group.fuelConsumptionLPer100km;
    const cost = dieselL * group.fuelPricePerLitre;
    return { cost, h2Kg: 0, kwh: 0, dieselL };
  }
  
  if (powertrain === 'bev') {
    const kwh = (totalKm / 100) * (config.electricityConsumptionKwhPer100km || 100);
    const cost = kwh * (config.electricityPricePerKwh || 0.18);
    return { cost, h2Kg: 0, kwh, dieselL: 0 };
  }
  
  if (powertrain === 'fuel_cell_h2') {
    const h2Kg = (totalKm / 100) * (config.hydrogenConsumptionKgPer100km || 8);
    const cost = h2Kg * (config.hydrogenPricePerKg || 7);
    return { cost, h2Kg, kwh: 0, dieselL: 0 };
  }
  
  // Mixed - assume 50/50 for simplicity
  const halfVehicles = vehicleCount / 2;
  const halfKm = totalKm / 2;
  
  const kwh = (halfKm / 100) * (config.electricityConsumptionKwhPer100km || 100);
  const kwhCost = kwh * (config.electricityPricePerKwh || 0.18);
  
  const h2Kg = (halfKm / 100) * (config.hydrogenConsumptionKgPer100km || 8);
  const h2Cost = h2Kg * (config.hydrogenPricePerKg || 7);
  
  return { cost: kwhCost + h2Cost, h2Kg, kwh, dieselL: 0 };
}

/**
 * Calculate CO2 emissions
 */
function calculateCO2(
  dieselL: number,
  kwh: number,
  h2Kg: number,
  co2PerLitre: number = 2.6,
  co2PerKwh: number = 0.2,
  co2PerKgH2: number = 0.1 // Green hydrogen default
): number {
  const dieselCO2 = dieselL * co2PerLitre;
  const elecCO2 = kwh * co2PerKwh;
  const h2CO2 = h2Kg * co2PerKgH2;
  
  return (dieselCO2 + elecCO2 + h2CO2) / 1000; // Return in tonnes
}

/**
 * Main calculation function - computes full scenario results
 */
export function computeScenarioResults(input: CalculationInput): ScenarioResults {
  const { scenario, vehicleGroups, configs, baselineScenarioResults } = input;
  const currentYear = new Date().getFullYear();
  const yearlyData: YearlyResult[] = [];
  
  let totalH2Kg = 0;
  let totalKwh = 0;
  let totalKm = 0;
  
  // Process each year
  for (let yearOffset = 0; yearOffset < scenario.analysisHorizonYears; yearOffset++) {
    const year = currentYear + yearOffset;
    
    let yearCapex = 0;
    let yearOpexFuel = 0;
    let yearOpexMaintenance = 0;
    let yearCO2 = 0;
    let yearKm = 0;
    let yearH2 = 0;
    let yearKwh = 0;
    
    let vehiclesDiesel = 0;
    let vehiclesBev = 0;
    let vehiclesH2 = 0;
    
    // Process each vehicle group
    for (const group of vehicleGroups) {
      const config = getConfigForGroup(group.id, configs);
      const isConverted = config && year >= config.conversionYear;
      const powertrain: TargetPowertrain = isConverted && config 
        ? config.targetPowertrain 
        : 'keep_diesel';
      
      // Count vehicles by type
      if (powertrain === 'keep_diesel') {
        vehiclesDiesel += group.count;
      } else if (powertrain === 'bev') {
        vehiclesBev += group.count;
      } else if (powertrain === 'fuel_cell_h2') {
        vehiclesH2 += group.count;
      } else if (powertrain === 'mixed') {
        vehiclesBev += Math.floor(group.count / 2);
        vehiclesH2 += Math.ceil(group.count / 2);
      }
      
      // CAPEX - only in conversion year
      if (config && year === config.conversionYear && config.targetPowertrain !== 'keep_diesel') {
        const netCapex = (config.newVehicleCapexPerUnit - config.subsidyPerVehicle) * group.count;
        yearCapex += Math.max(0, netCapex);
      }
      
      // Energy costs
      const energy = calculateAnnualEnergyCost(group, config, powertrain, group.count);
      yearOpexFuel += energy.cost;
      yearH2 += energy.h2Kg;
      yearKwh += energy.kwh;
      
      // Maintenance costs
      if (isConverted && config) {
        yearOpexMaintenance += config.maintenanceCostPerYearPerVehicleNew * group.count;
      } else {
        yearOpexMaintenance += group.maintenanceCostPerYearPerVehicle * group.count;
      }
      
      // CO2
      yearCO2 += calculateCO2(energy.dieselL, energy.kwh, energy.h2Kg, group.co2PerLitre);
      
      // Kilometers
      yearKm += group.count * group.avgKmPerYear;
    }
    
    const opexTotal = yearOpexFuel + yearOpexMaintenance;
    const totalCost = yearCapex + opexTotal;
    
    yearlyData.push({
      year,
      vehiclesDiesel,
      vehiclesBev,
      vehiclesH2,
      capex: yearCapex,
      opexFuel: yearOpexFuel,
      opexMaintenance: yearOpexMaintenance,
      opexTotal,
      totalCost,
      co2Tonnes: yearCO2,
      kmTotal: yearKm,
    });
    
    totalH2Kg += yearH2;
    totalKwh += yearKwh;
    totalKm += yearKm;
  }
  
  // Calculate totals
  const totalCapex = yearlyData.reduce((sum, y) => sum + y.capex, 0);
  const totalOpex = yearlyData.reduce((sum, y) => sum + y.opexTotal, 0);
  const totalCost = totalCapex + totalOpex;
  const totalCO2 = yearlyData.reduce((sum, y) => sum + y.co2Tonnes, 0);
  
  // NPV
  const cashFlows = yearlyData.map(y => y.totalCost);
  const npv = calculateNPV(cashFlows, scenario.discountRate);
  
  // TCO metrics
  const totalVehicles = vehicleGroups.reduce((sum, g) => sum + g.count, 0);
  const tcoPerKm = totalKm > 0 ? totalCost / totalKm : 0;
  const tcoPerVehicle = totalVehicles > 0 ? totalCost / totalVehicles : 0;
  
  // CO2 avoided vs baseline
  const baselineCO2 = baselineScenarioResults?.totals.totalCo2Tonnes || totalCO2;
  const co2Avoided = baselineCO2 - totalCO2;
  
  // Energy demand calculations
  const avgH2KgPerDay = totalH2Kg / (scenario.analysisHorizonYears * INFRA_PARAMS.daysPerYear);
  const avgKwhPerDay = totalKwh / (scenario.analysisHorizonYears * INFRA_PARAMS.daysPerYear);
  
  // Infrastructure estimates
  const h2StationsNeeded = Math.ceil(avgH2KgPerDay / INFRA_PARAMS.h2StationCapacityKgPerDay);
  const avgPowerKw = avgKwhPerDay / INFRA_PARAMS.avgHoursOperationPerDay;
  const evChargersNeeded = Math.ceil(avgPowerKw / INFRA_PARAMS.evChargerPowerKw);
  
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    yearlyData,
    totals: {
      totalCapex,
      totalOpex,
      totalCost,
      npv,
      tcoPerKm,
      tcoPerVehicle,
      totalCo2Tonnes: totalCO2,
      co2AvoidedVsBaseline: co2Avoided,
    },
    energyDemand: {
      totalH2Kg,
      totalKwh,
      avgH2KgPerDay,
      avgKwhPerDay,
    },
    infrastructure: {
      h2StationsNeeded: Math.max(0, h2StationsNeeded),
      evChargersNeeded: Math.max(0, evChargersNeeded),
    },
  };
}

/**
 * Compare multiple scenarios
 */
export function compareScenarios(
  scenarios: Scenario[],
  vehicleGroups: VehicleGroup[],
  configsByScenario: Record<string, ScenarioVehicleGroupConfig[]>
): ScenarioResults[] {
  // Find baseline scenario
  const baseline = scenarios.find(s => s.baseCaseFlag);
  let baselineResults: ScenarioResults | undefined;
  
  if (baseline) {
    baselineResults = computeScenarioResults({
      scenario: baseline,
      vehicleGroups,
      configs: configsByScenario[baseline.id] || [],
    });
  }
  
  return scenarios.map(scenario => {
    return computeScenarioResults({
      scenario,
      vehicleGroups,
      configs: configsByScenario[scenario.id] || [],
      baselineScenarioResults: scenario.baseCaseFlag ? undefined : baselineResults,
    });
  });
}

/**
 * Format currency value
 */
export function formatCurrency(value: number, currency: string = 'EUR'): string {
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
}

/**
 * Format large numbers with suffix (k, M)
 */
export function formatNumber(value: number, decimals: number = 1): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(decimals)}k`;
  }
  return value.toFixed(decimals);
}

/**
 * Format CO2 in tonnes
 */
export function formatCO2(tonnes: number): string {
  if (tonnes >= 1000) {
    return `${(tonnes / 1000).toFixed(1)}k t CO₂`;
  }
  return `${tonnes.toFixed(0)} t CO₂`;
}
