import { Scenario, ReferenceData } from './types';
import { calculateConditionMultipliers } from './conditions';
import { getEffectiveFleetComposition } from './fleetMix';
import { ExtendedVehicleParams } from './flexibleTCO';
import { getDefaultH2ConsumptionByPtac, DEFAULT_H2_CONSUMPTION } from './h2Defaults';

// Base consumption factors (before condition adjustments)
// Standardized to L/100km for diesel (Canadian/European standard)
// Note: Diesel consumption is now configurable via consumptionOverrides.diesel
const DEFAULT_L_PER_100KM_DIESEL = 35.7;   // ~35.7 L/100km for Class 8 trucks (= 2.8 km/L)
const BASE_KWH_PER_100KM_EV = 120;      // 120 kWh/100km (= 1.2 kWh/km) for Class 8 trucks
const BASE_KG_BIOMETHANE_PER_100KM = 28;// 28 kg/100km for biomethane trucks

// PHEV hybrid calculation constants
const PHEV_ELECTRIC_RATIO = 0.60;          // 60% of kilometers in electric mode
const PHEV_DIESEL_RATIO = 0.40;            // 40% of kilometers in thermal mode
const DEFAULT_PHEV_DIESEL_L_PER_100KM = 25; // L/100km in thermal mode (lighter than pure diesel)

interface OPEXBreakdown {
  fuelCost: number;
  maintenanceCost: number;
  insuranceCost: number;
  total: number;
  byType: {
    diesel: { fuel: number; maintenance: number; insurance: number };
    ev: { fuel: number; maintenance: number; insurance: number };
    hydrogen: { fuel: number; maintenance: number; insurance: number };
  };
  appliedMultipliers?: {
    consumption: number;
    maintenance: number;
  };
  appliedInflation?: {
    energy: number;
    maintenance: number;
    h2Energy?: number; // Separate H2 inflation if enabled
  };
  effectiveElectricityPrice?: number;
  appliedConsumption?: {
    diesel: number;     // L/100km
    ev: number;         // kWh/100km
    hydrogen: number;   // kg/100km
  };
}

/**
 * Calculate effective electricity price considering TOU rates
 * Formula: (offPeakRate × offPeakPercent + onPeakRate × (100 - offPeakPercent)) / 100
 */
function calculateEffectiveElectricityPrice(
  basePrice: number,
  touRates?: { offPeakRate: number; onPeakRate: number; offPeakPercent: number }
): number {
  if (!touRates || !touRates.offPeakRate || !touRates.onPeakRate) {
    return basePrice;
  }
  
  const { offPeakRate, onPeakRate, offPeakPercent } = touRates;
  const onPeakPercent = 100 - offPeakPercent;
  
  return (offPeakRate * offPeakPercent + onPeakRate * onPeakPercent) / 100;
}

/**
 * Apply inflation factor to a price
 * Formula: price × (1 + rate)^(year - 1)
 * Supports negative inflation rates (price decrease over time)
 */
function applyInflation(basePrice: number, inflationRate: number, year: number): number {
  if (year <= 1) return basePrice;
  return basePrice * Math.pow(1 + inflationRate, year - 1);
}

/**
 * Calculate OPEX for a specific year
 * Includes:
 * - Inflation on energy and maintenance costs
 * - TOU (Time-of-Use) rates for electricity
 * - Condition multipliers for consumption and maintenance
 */
export function calculateOPEXByYear(
  scenario: Scenario,
  referenceData: ReferenceData,
  year: number
): OPEXBreakdown {
  const { vehicleConfiguration, fleetComposition } = scenario;
  
  // Get effective fleet composition based on powertrain mix
  const effectiveFleet = getEffectiveFleetComposition(scenario);
  
  // Get extended vehicle params for consumption overrides and H2 inflation
  const vehicleParams = (fleetComposition as any)?.vehicleParams as ExtendedVehicleParams | undefined;
  const consumptionOverrides = vehicleParams?.consumptionOverrides;
  const h2Params = vehicleParams?.h2Params;
  
  // Calculate condition multipliers based on vehicle configuration
  // Pass multiplierOverrides to apply expert overrides if set
  const multipliers = calculateConditionMultipliers(
    vehicleConfiguration,
    vehicleConfiguration?.multiplierOverrides
  );
  
  // Multipliers are applied - debug logging removed for production
  
  // Extract inflation rates from scenario (default 0% if not specified)
  const energyInflationRate = fleetComposition.financialParams?.energyInflationRate 
    ? fleetComposition.financialParams.energyInflationRate / 100 
    : 0;
  const maintenanceInflationRate = fleetComposition.financialParams?.maintenanceInflationRate 
    ? fleetComposition.financialParams.maintenanceInflationRate / 100 
    : 0;
  
  // Check for separate H2 inflation rate (can be negative for expected price decrease)
  const h2InflationEnabled = h2Params?.h2InflationEnabled ?? false;
  const h2InflationRate = h2InflationEnabled && h2Params?.h2InflationRate !== undefined
    ? h2Params.h2InflationRate / 100
    : energyInflationRate;
  
  // Get base prices from user configuration (priority) or fall back to reference data
  const baseElectricityPrice = vehicleConfiguration?.electricityPrice ?? referenceData.electricity_price;
  const baseDieselPrice = vehicleConfiguration?.dieselPrice ?? referenceData.diesel_price;
  const baseHydrogenPrice = vehicleConfiguration?.hydrogenPrice ?? referenceData.hydrogen_price;
  
  // Calculate effective electricity price with TOU rates
  const touConfig = fleetComposition.energyCosts?.gridCharges?.touRates;
  const touRates = touConfig ? {
    offPeakRate: touConfig.offPeak,
    onPeakRate: touConfig.onPeak,
    offPeakPercent: touConfig.offPeakPercentage,
  } : undefined;
  const effectiveElectricityPrice = calculateEffectiveElectricityPrice(baseElectricityPrice, touRates);
  
  // Apply energy inflation to prices
  const inflatedElectricityPrice = applyInflation(effectiveElectricityPrice, energyInflationRate, year);
  const inflatedDieselPrice = applyInflation(baseDieselPrice, energyInflationRate, year);
  // H2 uses its own inflation rate if enabled (supports negative rates for price decrease)
  const inflatedHydrogenPrice = applyInflation(baseHydrogenPrice, h2InflationRate, year);
  
  // Get base maintenance costs from user configuration or reference data
  const baseMaintenanceDiesel = vehicleConfiguration?.maintenanceDiesel ?? referenceData.maintenance_diesel;
  const baseMaintenanceEv = vehicleConfiguration?.maintenanceEv ?? referenceData.maintenance_ev;
  const baseMaintenanceHydrogen = vehicleConfiguration?.maintenanceHydrogen ?? referenceData.maintenance_hydrogen;
  
  // Apply maintenance inflation
  const inflatedMaintenanceDiesel = applyInflation(baseMaintenanceDiesel, maintenanceInflationRate, year);
  const inflatedMaintenanceEv = applyInflation(baseMaintenanceEv, maintenanceInflationRate, year);
  const inflatedMaintenanceHydrogen = applyInflation(baseMaintenanceHydrogen, maintenanceInflationRate, year);
  
  // Calculate consumption rates - use overrides if provided, otherwise base values
  // Apply condition multipliers to adjust for operating conditions
  // Diesel consumption is now configurable via consumptionOverrides.diesel
  const dieselConsumption = (consumptionOverrides?.diesel ?? DEFAULT_L_PER_100KM_DIESEL) * multipliers.consumption; // L/100km
  const evConsumption = (consumptionOverrides?.bev ?? BASE_KWH_PER_100KM_EV) * multipliers.consumption; // kWh/100km
  // H2 consumption uses PTAC-aware default from h2Defaults.ts
  const h2BaseConsumption = consumptionOverrides?.h2 ?? getDefaultH2ConsumptionByPtac(vehicleConfiguration?.ptac);
  const h2Consumption = h2BaseConsumption * multipliers.consumption; // kg/100km
  
  // Diesel calculations (L/100km)
  const dieselKmTotal = effectiveFleet.diesel.count * effectiveFleet.diesel.annualKm;
  const dieselLiters = (dieselKmTotal / 100) * dieselConsumption;
  const dieselFuelCost = dieselLiters * inflatedDieselPrice;
  const dieselMaintenanceCost = effectiveFleet.diesel.count * inflatedMaintenanceDiesel * multipliers.maintenance;
  // Insurance is now managed exclusively via advancedCosts from the form
  const dieselInsuranceCost = 0;
  
  // EV calculations - Split between pure BEV and PHEV (hybrid 60% electric + 40% diesel)
  const evKmTotal = effectiveFleet.ev.count * effectiveFleet.ev.annualKm;
  const phevRatio = (effectiveFleet as any).phevRatio ?? 0; // From fleetMix.ts
  const bevRatio = 1 - phevRatio;
  
  // Pure BEV portion (100% electric)
  const bevKmTotal = evKmTotal * bevRatio;
  const bevKwh = (bevKmTotal / 100) * evConsumption;
  const bevFuelCost = bevKwh * inflatedElectricityPrice;
  
  // PHEV portion (60% electric + 40% diesel)
  const phevKmTotal = evKmTotal * phevRatio;
  // Electric portion of PHEV (60% of km)
  const phevElectricKm = phevKmTotal * PHEV_ELECTRIC_RATIO;
  const phevKwh = (phevElectricKm / 100) * evConsumption;
  const phevElectricCost = phevKwh * inflatedElectricityPrice;
  // Diesel portion of PHEV (40% of km)
  const phevDieselKm = phevKmTotal * PHEV_DIESEL_RATIO;
  const phevDieselConsumption = (consumptionOverrides?.phev ?? DEFAULT_PHEV_DIESEL_L_PER_100KM) * multipliers.consumption;
  const phevLiters = (phevDieselKm / 100) * phevDieselConsumption;
  const phevDieselCost = phevLiters * inflatedDieselPrice;
  
  // Total EV fuel cost = BEV + PHEV electric + PHEV diesel
  const evFuelCost = bevFuelCost + phevElectricCost + phevDieselCost;
  const evMaintenanceCost = effectiveFleet.ev.count * inflatedMaintenanceEv * multipliers.maintenance;
  // Insurance is now managed exclusively via advancedCosts from the form
  const evInsuranceCost = 0;
  
  // Hydrogen calculations (kg/100km)
  const h2KmTotal = effectiveFleet.hydrogen.count * effectiveFleet.hydrogen.annualKm;
  const h2Kg = (h2KmTotal / 100) * h2Consumption;
  const h2FuelCost = h2Kg * inflatedHydrogenPrice;
  const h2MaintenanceCost = effectiveFleet.hydrogen.count * inflatedMaintenanceHydrogen * multipliers.maintenance;
  // Insurance is now managed exclusively via advancedCosts from the form
  const h2InsuranceCost = 0;
  
  // Totals (now includes PHEV diesel in fuel cost)
  const totalFuelCost = dieselFuelCost + evFuelCost + h2FuelCost;
  const totalMaintenanceCost = dieselMaintenanceCost + evMaintenanceCost + h2MaintenanceCost;
  const totalInsuranceCost = dieselInsuranceCost + evInsuranceCost + h2InsuranceCost;
  
  return {
    fuelCost: totalFuelCost,
    maintenanceCost: totalMaintenanceCost,
    insuranceCost: totalInsuranceCost,
    total: totalFuelCost + totalMaintenanceCost + totalInsuranceCost,
    byType: {
      diesel: {
        fuel: dieselFuelCost,
        maintenance: dieselMaintenanceCost,
        insurance: dieselInsuranceCost,
      },
      ev: {
        fuel: evFuelCost,
        maintenance: evMaintenanceCost,
        insurance: evInsuranceCost,
      },
      hydrogen: {
        fuel: h2FuelCost,
        maintenance: h2MaintenanceCost,
        insurance: h2InsuranceCost,
      },
    },
    appliedMultipliers: {
      consumption: multipliers.consumption,
      maintenance: multipliers.maintenance,
    },
    appliedInflation: {
      energy: year > 1 ? Math.pow(1 + energyInflationRate, year - 1) : 1,
      maintenance: year > 1 ? Math.pow(1 + maintenanceInflationRate, year - 1) : 1,
      h2Energy: h2InflationEnabled ? Math.pow(1 + h2InflationRate, year - 1) : undefined,
    },
    effectiveElectricityPrice: inflatedElectricityPrice,
    appliedConsumption: {
      diesel: dieselConsumption,
      ev: evConsumption,
      hydrogen: h2Consumption,
    },
  };
}

/**
 * Calculate total OPEX over the analysis period
 */
export function calculateTotalOPEX(
  scenario: Scenario,
  referenceData: ReferenceData
): { total: number; byYear: OPEXBreakdown[] } {
  const byYear: OPEXBreakdown[] = [];
  let total = 0;
  
  for (let year = 1; year <= scenario.analysisYears; year++) {
    const yearlyOpex = calculateOPEXByYear(scenario, referenceData, year);
    byYear.push(yearlyOpex);
    total += yearlyOpex.total;
  }
  
  return { total, byYear };
}

/**
 * Calculate Present Value of OPEX using discount rate
 */
export function calculatePVOPEX(
  scenario: Scenario,
  referenceData: ReferenceData
): number {
  let pvOpex = 0;
  const discountRate = scenario.discountRate / 100; // Convert from percentage
  
  for (let year = 1; year <= scenario.analysisYears; year++) {
    const yearlyOpex = calculateOPEXByYear(scenario, referenceData, year);
    const discountFactor = Math.pow(1 + discountRate, year);
    pvOpex += yearlyOpex.total / discountFactor;
  }
  
  return pvOpex;
}
