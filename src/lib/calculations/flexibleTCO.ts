// ============= Flexible Scenario TCO Calculation =============

import { 
  FlexibleScenarioVehicle, 
  CreateFlexibleScenarioForm,
  convertAdvancedCostsToFleetConfig,
  TechnologyType,
  AdvancedCostsConfig,
} from './flexibleTypes';
import { 
  FleetComposition, 
  Scenario, 
  ReferenceData, 
  TCOResult,
  Region,
  DEFAULT_REFERENCE_DATA,
} from './types';
import { calculateTCO } from './tco';

/**
 * Map flexible technology types to fleet composition categories
 */
function mapTechnologyToFleetType(tech: TechnologyType): 'diesel' | 'ev' | 'hydrogen' {
  switch (tech) {
    case 'diesel':
    case 'gasoline':
    case 'cng':
    case 'biomethane':
    case 'hybrid_diesel':
    case 'hybrid_gasoline':
      return 'diesel'; // Group all ICE variants under diesel for TCO comparison
    case 'bev':
    case 'phev':
      return 'ev';
    case 'fcev':
      return 'hydrogen';
    default:
      return 'diesel';
  }
}

/**
 * Extended vehicle params interface with all advanced parameters
 */
export interface ExtendedVehicleParams {
  residualValuePercent?: number;
  lifeYears?: number;
  infrastructureCostTotal?: number;
  
  // Consumption overrides - includes diesel for configurable consumption
  consumptionOverrides?: {
    diesel?: number;     // L/100km (configurable by user)
    bev?: number;        // kWh/100km
    h2?: number;         // kg/100km
    biomethane?: number; // kg/100km
    phev?: number;       // L/100km (diesel portion of PHEV - 40% of trip)
  };
  
  // Hydrogen type for emissions calculation
  h2Type?: 'grey' | 'blue' | 'green';
  
  // Hydrogen-specific parameters
  h2Params?: {
    fcStackReplacementEnabled?: boolean;
    fcStackReplacementCost?: number;
    fcStackLifespanYears?: number;
    h2InflationEnabled?: boolean;
    h2InflationRate?: number;
    h2InfraScaleEnabled?: boolean;
    h2InfraScaleFactor?: number;
  };
  
  // Custom infrastructure
  customInfraEnabled?: boolean;
  customInfraCostPerVehicle?: number;
}

/**
 * Aggregate flexible vehicles into FleetComposition structure
 */
export function convertVehiclesToFleetComposition(
  vehicles: FlexibleScenarioVehicle[],
  advancedCosts?: AdvancedCostsConfig
): FleetComposition & { vehicleParams?: ExtendedVehicleParams } {
  const fleetComposition: FleetComposition = {
    diesel: { count: 0, annualKm: 0 },
    ev: { count: 0, annualKm: 0 },
    hydrogen: { count: 0, annualKm: 0 },
  };

  // Aggregate vehicles by technology type
  const aggregated: Record<'diesel' | 'ev' | 'hydrogen', { totalVehicles: number; totalKm: number }> = {
    diesel: { totalVehicles: 0, totalKm: 0 },
    ev: { totalVehicles: 0, totalKm: 0 },
    hydrogen: { totalVehicles: 0, totalKm: 0 },
  };

  // Track weighted residualValuePercent, lifeYears, and infrastructureCost
  let totalResidualWeighted = 0;
  let totalLifeWeighted = 0;
  let totalVehicleCount = 0;
  let totalInfrastructureCost = 0;
  
  // Track H2 type from FCEV vehicles (use first found or default to 'blue')
  let h2Type: 'green' | 'blue' | 'grey' | undefined;

  for (const vehicle of vehicles) {
    const fleetType = mapTechnologyToFleetType(vehicle.technology);
    aggregated[fleetType].totalVehicles += vehicle.vehicleCount;
    aggregated[fleetType].totalKm += vehicle.annualKm * vehicle.vehicleCount;
    
    // Accumulate weighted parameters
    totalResidualWeighted += (vehicle.residualValuePercent || 20) * vehicle.vehicleCount;
    totalLifeWeighted += (vehicle.lifeYears || 10) * vehicle.vehicleCount;
    totalVehicleCount += vehicle.vehicleCount;
    
    // Sum infrastructure costs if provided
    if (vehicle.hasInfrastructure && vehicle.infrastructureCost) {
      // If shared, count once; otherwise count per vehicle
      if (vehicle.infrastructureShared) {
        totalInfrastructureCost += vehicle.infrastructureCost;
      } else {
        totalInfrastructureCost += vehicle.infrastructureCost * vehicle.vehicleCount;
      }
    }
    
    // Extract h2Type from FCEV vehicles
    if (vehicle.technology === 'fcev' && vehicle.h2Type && !h2Type) {
      h2Type = vehicle.h2Type;
    }
  }

  // Calculate weighted average annual km for each type
  for (const type of ['diesel', 'ev', 'hydrogen'] as const) {
    const { totalVehicles, totalKm } = aggregated[type];
    fleetComposition[type] = {
      count: totalVehicles,
      annualKm: totalVehicles > 0 ? totalKm / totalVehicles : 0,
    };
  }

  // Add advanced cost configurations if provided
  if (advancedCosts) {
    const advancedConfig = convertAdvancedCostsToFleetConfig(advancedCosts);
    Object.assign(fleetComposition, advancedConfig);
  }

  // Build extended vehicle parameters
  const result = fleetComposition as FleetComposition & { vehicleParams?: ExtendedVehicleParams };
  
  if (totalVehicleCount > 0) {
    // Build consumption overrides from advancedCosts
    const consumptionOverrides: ExtendedVehicleParams['consumptionOverrides'] = {};
    if (advancedCosts?.consumptionBev) {
      consumptionOverrides.bev = advancedCosts.consumptionBev;
    }
    if (advancedCosts?.consumptionH2) {
      consumptionOverrides.h2 = advancedCosts.consumptionH2;
    }
    if (advancedCosts?.consumptionBiomethane) {
      consumptionOverrides.biomethane = advancedCosts.consumptionBiomethane;
    }
    if ((advancedCosts as any)?.consumptionPhev) {
      consumptionOverrides.phev = (advancedCosts as any).consumptionPhev;
    }
    
    // Build H2 params
    const h2Params: ExtendedVehicleParams['h2Params'] = {};
    if (advancedCosts?.fcStackReplacementEnabled !== undefined) {
      h2Params.fcStackReplacementEnabled = advancedCosts.fcStackReplacementEnabled;
      h2Params.fcStackReplacementCost = advancedCosts.fcStackReplacementCost;
      h2Params.fcStackLifespanYears = advancedCosts.fcStackLifespanYears;
    }
    if (advancedCosts?.h2InflationEnabled !== undefined) {
      h2Params.h2InflationEnabled = advancedCosts.h2InflationEnabled;
      h2Params.h2InflationRate = advancedCosts.h2InflationRate;
    }
    if (advancedCosts?.h2InfraScaleEnabled !== undefined) {
      h2Params.h2InfraScaleEnabled = advancedCosts.h2InfraScaleEnabled;
      h2Params.h2InfraScaleFactor = advancedCosts.h2InfraScaleFactor;
    }
    
    // Custom infrastructure from advancedCosts
    let customInfraTotal = totalInfrastructureCost;
    if (advancedCosts?.customInfraEnabled && advancedCosts.infrastructureCostPerVehicle) {
      customInfraTotal = advancedCosts.infrastructureCostPerVehicle * totalVehicleCount;
    }
    
    result.vehicleParams = {
      residualValuePercent: totalResidualWeighted / totalVehicleCount,
      lifeYears: totalLifeWeighted / totalVehicleCount,
      infrastructureCostTotal: customInfraTotal > 0 ? customInfraTotal : undefined,
      consumptionOverrides: Object.keys(consumptionOverrides).length > 0 ? consumptionOverrides : undefined,
      h2Type: h2Type || 'blue',
      h2Params: Object.keys(h2Params).length > 0 ? h2Params : undefined,
      customInfraEnabled: advancedCosts?.customInfraEnabled,
      customInfraCostPerVehicle: advancedCosts?.infrastructureCostPerVehicle,
    };
  }

  return result;
}

/**
 * Build reference data from flexible scenario vehicles
 * Uses user-provided values or falls back to defaults
 */
export function buildReferenceDataFromVehicles(
  vehicles: FlexibleScenarioVehicle[],
  region: Region
): ReferenceData {
  const refData = { ...DEFAULT_REFERENCE_DATA };

  // Calculate weighted averages from vehicle data
  const byType = {
    diesel: { capex: 0, maintenance: 0, count: 0 },
    ev: { capex: 0, maintenance: 0, count: 0, energyPrice: 0 },
    hydrogen: { capex: 0, maintenance: 0, count: 0, energyPrice: 0 },
  };

  for (const vehicle of vehicles) {
    const fleetType = mapTechnologyToFleetType(vehicle.technology);
    byType[fleetType].capex += vehicle.purchasePrice * vehicle.vehicleCount;
    byType[fleetType].maintenance += vehicle.annualMaintenanceCost * vehicle.vehicleCount;
    byType[fleetType].count += vehicle.vehicleCount;

    // Track energy prices for EV/H2
    if (fleetType === 'ev') {
      byType.ev.energyPrice += vehicle.energyPrice * vehicle.vehicleCount;
    } else if (fleetType === 'hydrogen') {
      byType.hydrogen.energyPrice += vehicle.energyPrice * vehicle.vehicleCount;
    }
  }

  // Calculate averages and update reference data
  if (byType.diesel.count > 0) {
    refData.diesel_truck = byType.diesel.capex / byType.diesel.count;
    refData.maintenance_diesel = byType.diesel.maintenance / byType.diesel.count;
  }

  if (byType.ev.count > 0) {
    refData.ev_truck = byType.ev.capex / byType.ev.count;
    refData.maintenance_ev = byType.ev.maintenance / byType.ev.count;
    refData.electricity_price = byType.ev.energyPrice / byType.ev.count;
  }

  if (byType.hydrogen.count > 0) {
    refData.hydrogen_truck = byType.hydrogen.capex / byType.hydrogen.count;
    refData.maintenance_hydrogen = byType.hydrogen.maintenance / byType.hydrogen.count;
    refData.hydrogen_price = byType.hydrogen.energyPrice / byType.hydrogen.count;
  }

  return refData;
}

/**
 * Calculate TCO for a flexible scenario
 */
export function calculateFlexibleTCO(
  formData: CreateFlexibleScenarioForm,
  scenarioId: string = 'flexible-' + Date.now()
): TCOResult {
  const fleetComposition = convertVehiclesToFleetComposition(
    formData.vehicles,
    formData.advancedCosts
  );

  const referenceData = buildReferenceDataFromVehicles(
    formData.vehicles,
    formData.region as Region
  );

  const scenario: Scenario = {
    id: scenarioId,
    projectId: 'flexible',
    name: formData.name,
    region: formData.region as Region,
    analysisYears: formData.financialParams.analysisHorizonYears,
    discountRate: formData.financialParams.discountRate,
    fleetComposition,
    createdAt: new Date().toISOString(),
  };

  return calculateTCO(scenario, referenceData);
}

/**
 * Calculate detailed breakdown per vehicle type for flexible scenarios
 */
export function calculateFlexibleTCOWithDetails(
  formData: CreateFlexibleScenarioForm,
  scenarioId: string = 'flexible-' + Date.now()
): {
  result: TCOResult;
  vehicleDetails: Array<{
    vehicle: FlexibleScenarioVehicle;
    annualCost: number;
    totalCost: number;
    co2Annual: number;
  }>;
} {
  const result = calculateFlexibleTCO(formData, scenarioId);

  // Calculate per-vehicle details
  const vehicleDetails = formData.vehicles.map((vehicle) => {
    const annualFuelCost = (vehicle.consumption / 100) * vehicle.annualKm * vehicle.energyPrice;
    const annualCost = annualFuelCost + vehicle.annualMaintenanceCost;
    const totalCost = annualCost * formData.financialParams.analysisHorizonYears + 
                      (vehicle.purchasePrice - vehicle.subsidiesPerVehicle);

    // Estimate CO2 (simplified - actual calculation is more complex)
    const fleetType = mapTechnologyToFleetType(vehicle.technology);
    const co2Factor = fleetType === 'diesel' ? 2.68 : fleetType === 'hydrogen' ? 0.5 : 0.05;
    const co2Annual = (vehicle.consumption / 100) * vehicle.annualKm * co2Factor * vehicle.vehicleCount;

    return {
      vehicle,
      annualCost: annualCost * vehicle.vehicleCount,
      totalCost: totalCost * vehicle.vehicleCount,
      co2Annual,
    };
  });

  return { result, vehicleDetails };
}
