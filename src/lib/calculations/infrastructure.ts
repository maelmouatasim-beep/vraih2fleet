import { Scenario, ReferenceData } from './types';
import { getEffectiveFleetComposition } from './fleetMix';

// Infrastructure constants for COUNT calculations only
// Note: These do NOT include costs - costs must be provided by user
const EV_AUTONOMY_KM = 500;           // km per charge
const H2_AUTONOMY_KM = 350;           // km per fill
const CHARGES_PER_STATION_PER_DAY = 3; // 8 hours to charge, 3 charges per day
const FILLS_PER_H2_STATION_PER_DAY = 30; // H2 refueling is faster
const DAYS_PER_YEAR = 365;

// Default utilization rate for chargers (80%)
const DEFAULT_UTILIZATION_RATE = 0.8;

// Charger costs by speed
export const EV_CHARGER_COSTS = {
  slow: { unit: 3500, install: 5000, power: 7 },
  fast: { unit: 45000, install: 15000, power: 50 },
  ultra: { unit: 150000, install: 25000, power: 150 },
} as const;

// H2 station costs by capacity
export const H2_STATION_COSTS = {
  '100': { min: 1500000, max: 2500000 },
  '200': { min: 2000000, max: 3500000 },
  '500': { min: 3500000, max: 5000000 },
  '1000': { min: 5000000, max: 8000000 },
} as const;

export type ChargingSpeed = 'slow' | 'fast' | 'ultra';
export type H2StationCapacity = '100' | '200' | '500' | '1000';

interface InfrastructureResult {
  chargingStations: number;
  chargingStationsCost: number;
  h2Stations: number;
  h2StationsCost: number;
  totalCost: number;
  details: {
    dailyEVChargesNeeded: number;
    dailyH2FillsNeeded: number;
  };
}

/**
 * SINGLE SOURCE: Calculate EV chargers needed
 * Formula: ceil(evFleetSize × batteryCapacity ÷ (chargingSpeed × hoursAvailable × utilizationRate))
 */
export interface EVChargersParams {
  evFleetSize: number;
  batteryCapacity: number; // kWh
  chargingSpeed: ChargingSpeed;
  hoursAvailable: number;
  utilizationRate?: number; // 0-1, default 0.8
}

export interface EVChargersResult {
  chargersNeeded: number;
  chargerPower: number; // kW
  totalPowerCapacity: number; // kW
  chargeTimePerVehicle: number; // hours
  capexPerCharger: number;
  totalCapex: number;
  formula: string;
}

export function calculateEVChargers(params: EVChargersParams): EVChargersResult {
  const {
    evFleetSize,
    batteryCapacity,
    chargingSpeed,
    hoursAvailable,
    utilizationRate = DEFAULT_UTILIZATION_RATE,
  } = params;

  // Defensive guard: validate chargingSpeed before accessing EV_CHARGER_COSTS
  const validSpeed: ChargingSpeed = ['slow', 'fast', 'ultra'].includes(chargingSpeed) 
    ? chargingSpeed 
    : 'fast';
  
  const chargerConfig = EV_CHARGER_COSTS[validSpeed];
  const chargerPower = chargerConfig.power;
  const chargeTimePerVehicle = batteryCapacity / chargerPower;
  
  // Formula: ceil(evFleetSize × chargeTimePerVehicle ÷ (hoursAvailable × utilizationRate))
  const effectiveHours = hoursAvailable * utilizationRate;
  const chargersNeeded = Math.ceil(
    (evFleetSize * chargeTimePerVehicle) / effectiveHours
  );
  
  const totalPowerCapacity = chargersNeeded * chargerPower;
  const capexPerCharger = chargerConfig.unit + chargerConfig.install;
  const totalCapex = chargersNeeded * capexPerCharger;

  const formula = `ceil(${evFleetSize} × ${batteryCapacity}kWh ÷ (${chargerPower}kW × ${hoursAvailable}h × ${utilizationRate}))`;

  return {
    chargersNeeded: Math.max(0, chargersNeeded),
    chargerPower,
    totalPowerCapacity,
    chargeTimePerVehicle,
    capexPerCharger,
    totalCapex,
    formula,
  };
}

/**
 * SINGLE SOURCE: Calculate H2 stations needed
 * Formula: ceil(totalDailyDemand ÷ stationCapacity)
 */
export interface H2StationsParams {
  h2FleetSize: number;
  dailyKgPerVehicle: number;
  refuelingFrequency?: number; // per day, default 1
  stationCapacity: H2StationCapacity;
  capexPerStation?: number; // Override default
  landAndPermits?: number;
}

export interface H2StationsResult {
  stationsNeeded: number;
  totalDailyDemand: number; // kg
  capexPerStation: number;
  landAndPermits: number;
  totalCapex: number;
  formula: string;
}

export function calculateH2Stations(params: H2StationsParams): H2StationsResult {
  const {
    h2FleetSize,
    dailyKgPerVehicle,
    refuelingFrequency = 1,
    stationCapacity,
    landAndPermits = 350000,
  } = params;

  // Defensive guard: validate stationCapacity before accessing H2_STATION_COSTS
  const validCapacity: H2StationCapacity = ['100', '200', '500', '1000'].includes(stationCapacity)
    ? stationCapacity
    : '200';
  
  const stationCosts = H2_STATION_COSTS[validCapacity];
  const defaultCapex = (stationCosts.min + stationCosts.max) / 2;
  const capexPerStation = params.capexPerStation ?? defaultCapex;

  const totalDailyDemand = h2FleetSize * dailyKgPerVehicle * refuelingFrequency;
  const stationCapacityNum = parseInt(validCapacity);
  const stationsNeeded = Math.ceil(totalDailyDemand / stationCapacityNum);
  
  const totalCapex = stationsNeeded * (capexPerStation + landAndPermits);

  const formula = `ceil(${h2FleetSize} × ${dailyKgPerVehicle}kg × ${refuelingFrequency} ÷ ${validCapacity}kg/day)`;

  return {
    stationsNeeded: Math.max(0, stationsNeeded),
    totalDailyDemand,
    capexPerStation,
    landAndPermits,
    totalCapex,
    formula,
  };
}

/**
 * SINGLE SOURCE: Calculate total infrastructure investment
 */
export interface TotalInfrastructureParams {
  evResult: EVChargersResult;
  h2Result: H2StationsResult;
  sitePrepCosts?: number;
  gridUpgradeCosts?: number;
}

export interface TotalInfrastructureResult {
  h2Capex: number;
  evCapex: number;
  sitePrepCosts: number;
  gridUpgradeCosts: number;
  totalCapex: number;
  annualOpex: number; // 5% EV, 12% H2
  total10YearCost: number;
  breakdown: {
    label: string;
    value: number;
    source: 'calculated' | 'user_input' | 'reference_data' | 'real_data';
    formula?: string;
  }[];
}

export function calculateTotalInfrastructure(params: TotalInfrastructureParams): TotalInfrastructureResult {
  const {
    evResult,
    h2Result,
    sitePrepCosts = 0,
    gridUpgradeCosts = 0,
  } = params;

  const h2Capex = h2Result.totalCapex;
  const evCapex = evResult.totalCapex + gridUpgradeCosts;
  
  // Total CAPEX = H2 CAPEX + EV CAPEX + Site Prep
  const totalCapex = h2Capex + evCapex + sitePrepCosts;
  
  // OPEX: 12% of H2 annually, 5% of EV annually
  const h2AnnualOpex = h2Capex * 0.12;
  const evAnnualOpex = evCapex * 0.05;
  const annualOpex = h2AnnualOpex + evAnnualOpex;
  
  const total10YearCost = totalCapex + (annualOpex * 10);

  const breakdown: TotalInfrastructureResult['breakdown'] = [
    {
      label: 'H₂ Stations',
      value: h2Result.totalCapex,
      source: 'calculated',
      formula: `${h2Result.stationsNeeded} stations × ($${(h2Result.capexPerStation / 1000000).toFixed(1)}M + $${(h2Result.landAndPermits / 1000).toFixed(0)}k)`,
    },
    {
      label: 'EV Chargers',
      value: evResult.totalCapex,
      source: 'calculated',
      formula: `${evResult.chargersNeeded} chargers × $${evResult.capexPerCharger.toLocaleString()}`,
    },
  ];

  if (gridUpgradeCosts > 0) {
    breakdown.push({
      label: 'Grid Upgrade',
      value: gridUpgradeCosts,
      source: 'user_input' as const,
    });
  }

  if (sitePrepCosts > 0) {
    breakdown.push({
      label: 'Site Preparation',
      value: sitePrepCosts,
      source: 'user_input' as const,
    });
  }

  return {
    h2Capex,
    evCapex,
    sitePrepCosts,
    gridUpgradeCosts,
    totalCapex,
    annualOpex,
    total10YearCost,
    breakdown,
  };
}

/**
 * Infrastructure data stored in scenario.fleetComposition.infrastructure
 */
export interface AppliedInfrastructure {
  source: 'infrastructure_plan' | 'user_input';
  planId?: string;
  totalCapex: number;
  evCapex?: number;
  h2Capex?: number;
  pricingSource?: string;
  updatedAt?: string;
}

/**
 * Legacy function for scenario-based calculations
 * Now reads infrastructure costs from scenario.fleetComposition.infrastructure if available
 * Otherwise returns COUNT only with costs = 0 to prevent phantom data
 */
export function calculateInfrastructure(
  scenario: Scenario,
  _referenceData: ReferenceData
): InfrastructureResult {
  // Get effective fleet composition based on powertrain mix
  const fleetComposition = getEffectiveFleetComposition(scenario);
  
  // Check if infrastructure has been explicitly applied to this scenario
  // IMPORTANT: Read from raw fleetComposition, not from getEffectiveFleetComposition
  // as the infrastructure block is stored in scenario.fleetComposition directly
  const rawFleet = scenario.fleetComposition as unknown as Record<string, unknown>;
  const appliedInfra = rawFleet?.infrastructure as AppliedInfrastructure | undefined;
  
  // EV charging infrastructure - COUNT only
  const totalEvKmPerYear = fleetComposition.ev.count * fleetComposition.ev.annualKm;
  const totalEvChargesPerYear = totalEvKmPerYear / EV_AUTONOMY_KM;
  const dailyEvChargesNeeded = totalEvChargesPerYear / DAYS_PER_YEAR;
  const chargingStations = Math.ceil(dailyEvChargesNeeded / CHARGES_PER_STATION_PER_DAY);
  
  // H2 refueling infrastructure - COUNT only
  const totalH2KmPerYear = fleetComposition.hydrogen.count * fleetComposition.hydrogen.annualKm;
  const totalH2FillsPerYear = totalH2KmPerYear / H2_AUTONOMY_KM;
  const dailyH2FillsNeeded = totalH2FillsPerYear / DAYS_PER_YEAR;
  const h2Stations = Math.ceil(dailyH2FillsNeeded / FILLS_PER_H2_STATION_PER_DAY);
  
  // If infrastructure has been applied, use those costs
  if (appliedInfra && appliedInfra.totalCapex > 0) {
    return {
      chargingStations: Math.max(0, chargingStations),
      chargingStationsCost: appliedInfra.evCapex || 0,
      h2Stations: Math.max(0, h2Stations),
      h2StationsCost: appliedInfra.h2Capex || 0,
      totalCost: appliedInfra.totalCapex,
      details: {
        dailyEVChargesNeeded: dailyEvChargesNeeded,
        dailyH2FillsNeeded: dailyH2FillsNeeded,
      },
    };
  }
  
  // No applied infrastructure - return counts only with 0 costs (no phantom data)
  return {
    chargingStations: Math.max(0, chargingStations),
    chargingStationsCost: 0,
    h2Stations: Math.max(0, h2Stations),
    h2StationsCost: 0,
    totalCost: 0,
    details: {
      dailyEVChargesNeeded: dailyEvChargesNeeded,
      dailyH2FillsNeeded: dailyH2FillsNeeded,
    },
  };
}
