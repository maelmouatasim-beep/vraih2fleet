import { Scenario, ReferenceData, VehicleTypeCosts } from './types';
import { getEffectiveFleetComposition } from './fleetMix';

/**
 * Calculate CAPEX (Capital Expenditure) for a scenario
 * CAPEX = sum of (count × vehicle_cost) for each vehicle type
 * Uses targetPowertrainMix to determine fleet composition
 */
export function calculateCapex(
  scenario: Scenario,
  referenceData: ReferenceData
): { total: number; byType: Pick<Record<string, VehicleTypeCosts>, 'diesel' | 'ev' | 'hydrogen'> } {
  // Get effective fleet composition based on powertrain mix
  const fleetComposition = getEffectiveFleetComposition(scenario);
  
  // Get vehicle prices - use vehiclePrices from configuration if available, otherwise use reference data
  const vehicleConfig = scenario.vehicleConfiguration;
  const vehiclePrices = vehicleConfig?.vehiclePrices;
  
  // Calculate prices for each category
  // For diesel: use vehiclePrices.diesel if available, otherwise use reference or currentVehiclePrice
  const dieselPrice = vehiclePrices?.diesel ?? vehicleConfig?.currentVehiclePrice ?? referenceData.diesel_truck;
  
  // For EV: weighted average of BEV and PHEV prices if both present, or use single price
  const bevPrice = vehiclePrices?.bev ?? vehicleConfig?.alternativeVehiclePrice ?? referenceData.ev_truck;
  const phevPrice = vehiclePrices?.phev ?? vehicleConfig?.alternativeVehiclePrice ?? referenceData.ev_truck;
  const mix = vehicleConfig?.targetPowertrainMix;
  const evPrice = mix && (mix.bev > 0 || mix.phev > 0)
    ? ((mix.bev || 0) * bevPrice + (mix.phev || 0) * phevPrice) / ((mix.bev || 0) + (mix.phev || 0) || 1)
    : bevPrice;
  
  // For hydrogen: use vehiclePrices.fcev if available
  const hydrogenPrice = vehiclePrices?.fcev ?? vehicleConfig?.alternativeVehiclePrice ?? referenceData.hydrogen_truck;
  
  const dieselCapex = fleetComposition.diesel.count * dieselPrice;
  const evCapex = fleetComposition.ev.count * evPrice;
  const hydrogenCapex = fleetComposition.hydrogen.count * hydrogenPrice;
  
  const total = dieselCapex + evCapex + hydrogenCapex;
  
  return {
    total,
    byType: {
      diesel: {
        count: fleetComposition.diesel.count,
        capex: dieselCapex,
        opex: 0,
        fuelCost: 0,
        maintenanceCost: 0,
        insuranceCost: 0,
        co2: 0,
      },
      ev: {
        count: fleetComposition.ev.count,
        capex: evCapex,
        opex: 0,
        fuelCost: 0,
        maintenanceCost: 0,
        insuranceCost: 0,
        co2: 0,
      },
      hydrogen: {
        count: fleetComposition.hydrogen.count,
        capex: hydrogenCapex,
        opex: 0,
        fuelCost: 0,
        maintenanceCost: 0,
        insuranceCost: 0,
        co2: 0,
      },
    },
  };
}

/**
 * Calculate residual value at end of analysis period
 * Uses user-provided residualValuePercent if available,
 * otherwise linear depreciation over lifeYears with a 10% floor
 * 
 * @param capex - Initial capital expenditure
 * @param analysisYears - Number of years for analysis
 * @param residualValuePercent - User-provided residual value as % of CAPEX (optional)
 * @param lifeYears - Expected vehicle life in years (optional, default 12)
 */
export function calculateResidualValue(
  capex: number, 
  analysisYears: number = 10,
  residualValuePercent?: number,
  lifeYears?: number
): number {
  // If user provided a specific residual value percentage, use it
  if (residualValuePercent !== undefined && residualValuePercent >= 0) {
    return capex * (residualValuePercent / 100);
  }
  
  // Otherwise, calculate based on depreciation schedule
  const effectiveLifeYears = lifeYears || 12;
  const minResidualPercent = 0.10;
  const depreciationPercent = Math.min(analysisYears / effectiveLifeYears, 0.90);
  return capex * Math.max(minResidualPercent, 1 - depreciationPercent);
}
