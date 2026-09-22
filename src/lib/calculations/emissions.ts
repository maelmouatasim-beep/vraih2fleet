import { Scenario, ReferenceData } from './types';
import { getEffectiveFleetComposition } from './fleetMix';
import { ExtendedVehicleParams } from './flexibleTCO';

// Emission factors - standardized to L/100km for diesel (Canadian/European standard)
const DEFAULT_L_PER_100KM_DIESEL = 35.7;   // ~35.7 L/100km for Class 8 trucks
const KG_CO2_PER_LITER_DIESEL = 2.68;      // Standard diesel emission factor (kg CO2/L)
const KWH_PER_KM_EV = 0.2;
const KG_H2_PER_KM = 0.012;

// Hydrogen emission factors by type
const KG_CO2_PER_KG_H2_GREY = 10.0;        // Grey hydrogen (steam methane reforming without CCS)
const KG_CO2_PER_KG_H2_BLUE = 3.0;         // Blue hydrogen (with carbon capture)
const KG_CO2_PER_KG_H2_GREEN = 0.5;        // Green hydrogen (electrolysis with renewable energy)

// Biomethane emission factor (kg CO2/kg)
const KG_CO2_PER_KG_BIOMETHANE = 0.5;      // Biomethane is nearly carbon neutral
const KG_BIOMETHANE_PER_100KM = 28;        // Base consumption for biomethane trucks

// PHEV hybrid calculation constants
const PHEV_ELECTRIC_RATIO = 0.60;          // 60% of kilometers in electric mode
const PHEV_DIESEL_RATIO = 0.40;            // 40% of kilometers in thermal mode
const DEFAULT_PHEV_DIESEL_L_PER_100KM = 25; // L/100km in thermal mode

export type HydrogenType = 'grey' | 'blue' | 'green';

interface EmissionsResult {
  total: number;
  byType: {
    diesel: number;
    ev: number;
    hydrogen: number;
    biomethane?: number;
  };
  dieselOnlyBaseline: number;
  savings: number;
  savingsPercent: number;
  hydrogenType?: HydrogenType;
}

/**
 * Get CO2 emission factor for hydrogen based on type
 */
export function getH2EmissionFactor(h2Type: HydrogenType = 'blue'): number {
  switch (h2Type) {
    case 'grey':
      return KG_CO2_PER_KG_H2_GREY;
    case 'green':
      return KG_CO2_PER_KG_H2_GREEN;
    case 'blue':
    default:
      return KG_CO2_PER_KG_H2_BLUE;
  }
}

/**
 * Calculate annual CO2 emissions for a scenario
 * Uses targetPowertrainMix to determine fleet composition
 * Supports configurable diesel consumption, H2 type (green/blue/grey), and biomethane
 */
export function calculateAnnualEmissions(
  scenario: Scenario,
  referenceData: ReferenceData
): EmissionsResult {
  // Get effective fleet composition based on powertrain mix
  const fleetComposition = getEffectiveFleetComposition(scenario);
  
  // Get extended vehicle params for consumption overrides and H2 type
  const vehicleParams = (scenario.fleetComposition as any)?.vehicleParams as ExtendedVehicleParams | undefined;
  const consumptionOverrides = vehicleParams?.consumptionOverrides;
  
  // Get H2 type from vehicle params (default to blue)
  const h2Type: HydrogenType = (vehicleParams as any)?.h2Type || 'blue';
  const h2EmissionFactor = getH2EmissionFactor(h2Type);
  
  // Use user-provided diesel consumption or default
  const dieselConsumption = consumptionOverrides?.diesel ?? DEFAULT_L_PER_100KM_DIESEL;
  
  // Diesel emissions (using L/100km - configurable)
  const dieselKmTotal = fleetComposition.diesel.count * fleetComposition.diesel.annualKm;
  const dieselLiters = (dieselKmTotal / 100) * dieselConsumption;
  const dieselCO2 = dieselLiters * KG_CO2_PER_LITER_DIESEL;
  
  // EV emissions - Split between pure BEV and PHEV (hybrid 60% electric + 40% diesel)
  const evKmTotal = fleetComposition.ev.count * fleetComposition.ev.annualKm;
  const phevRatio = (fleetComposition as any).phevRatio ?? 0;
  const bevRatio = 1 - phevRatio;
  
  // Pure BEV portion (100% electric)
  const bevKmTotal = evKmTotal * bevRatio;
  const bevKwh = bevKmTotal * KWH_PER_KM_EV;
  const bevMwh = bevKwh / 1000;
  const bevCO2 = bevMwh * referenceData.co2_factor_grid;
  
  // PHEV portion (60% electric + 40% diesel)
  const phevKmTotal = evKmTotal * phevRatio;
  // Electric portion of PHEV (60%)
  const phevElectricKm = phevKmTotal * PHEV_ELECTRIC_RATIO;
  const phevKwh = phevElectricKm * KWH_PER_KM_EV;
  const phevMwh = phevKwh / 1000;
  const phevElectricCO2 = phevMwh * referenceData.co2_factor_grid;
  // Diesel portion of PHEV (40%)
  const phevDieselKm = phevKmTotal * PHEV_DIESEL_RATIO;
  const phevDieselConsumption = consumptionOverrides?.phev ?? DEFAULT_PHEV_DIESEL_L_PER_100KM;
  const phevLiters = (phevDieselKm / 100) * phevDieselConsumption;
  const phevDieselCO2 = phevLiters * KG_CO2_PER_LITER_DIESEL;
  
  // Total EV CO2 = BEV + PHEV electric + PHEV diesel
  const evCO2 = bevCO2 + phevElectricCO2 + phevDieselCO2;
  
  // Hydrogen emissions (supports green/blue/grey)
  const h2KmTotal = fleetComposition.hydrogen.count * fleetComposition.hydrogen.annualKm;
  const h2Kg = h2KmTotal * KG_H2_PER_KM;
  const h2CO2 = h2Kg * h2EmissionFactor;
  
  // Biomethane emissions (if present in vehicle params)
  const biomethaneCount = (fleetComposition as any).biomethane?.count ?? 0;
  const biomethaneAnnualKm = (fleetComposition as any).biomethane?.annualKm ?? 0;
  const biomethaneKmTotal = biomethaneCount * biomethaneAnnualKm;
  const biomethaneConsumption = consumptionOverrides?.biomethane ?? KG_BIOMETHANE_PER_100KM;
  const biomethaneKg = (biomethaneKmTotal / 100) * biomethaneConsumption;
  const biomethaneCO2 = biomethaneKg * KG_CO2_PER_KG_BIOMETHANE;
  
  const total = dieselCO2 + evCO2 + h2CO2 + biomethaneCO2;
  
  // Calculate diesel-only baseline for comparison
  const totalVehicles = fleetComposition.diesel.count + 
                        fleetComposition.ev.count + 
                        fleetComposition.hydrogen.count + 
                        biomethaneCount;
                        
  const avgAnnualKm = totalVehicles > 0 ? (
    fleetComposition.diesel.count * fleetComposition.diesel.annualKm +
    fleetComposition.ev.count * fleetComposition.ev.annualKm +
    fleetComposition.hydrogen.count * fleetComposition.hydrogen.annualKm +
    biomethaneKmTotal
  ) / totalVehicles : 0;
  
  const dieselOnlyKm = totalVehicles * avgAnnualKm;
  const dieselOnlyLiters = (dieselOnlyKm / 100) * dieselConsumption;
  const dieselOnlyBaseline = dieselOnlyLiters * KG_CO2_PER_LITER_DIESEL;
  
  const savings = dieselOnlyBaseline - total;
  const savingsPercent = dieselOnlyBaseline > 0 ? (savings / dieselOnlyBaseline) * 100 : 0;
  
  return {
    total,
    byType: {
      diesel: dieselCO2,
      ev: evCO2,
      hydrogen: h2CO2,
      biomethane: biomethaneCO2 > 0 ? biomethaneCO2 : undefined,
    },
    dieselOnlyBaseline,
    savings,
    savingsPercent,
    hydrogenType: h2Type,
  };
}

/**
 * Calculate total emissions over the analysis period
 */
export function calculateTotalEmissions(
  scenario: Scenario,
  referenceData: ReferenceData
): EmissionsResult {
  const annualEmissions = calculateAnnualEmissions(scenario, referenceData);
  
  // Multiply by analysis years for total
  return {
    total: annualEmissions.total * scenario.analysisYears,
    byType: {
      diesel: annualEmissions.byType.diesel * scenario.analysisYears,
      ev: annualEmissions.byType.ev * scenario.analysisYears,
      hydrogen: annualEmissions.byType.hydrogen * scenario.analysisYears,
      biomethane: annualEmissions.byType.biomethane 
        ? annualEmissions.byType.biomethane * scenario.analysisYears 
        : undefined,
    },
    dieselOnlyBaseline: annualEmissions.dieselOnlyBaseline * scenario.analysisYears,
    savings: annualEmissions.savings * scenario.analysisYears,
    savingsPercent: annualEmissions.savingsPercent,
    hydrogenType: annualEmissions.hydrogenType,
  };
}

/**
 * Convert kg to tonnes
 */
export function kgToTonnes(kg: number): number {
  return kg / 1000;
}

/**
 * Get emission factor label for display
 */
export function getH2TypeLabel(h2Type: HydrogenType, isEnglish: boolean = true): string {
  const labels = {
    grey: isEnglish ? 'Grey H₂ (SMR)' : 'H₂ Gris (SMR)',
    blue: isEnglish ? 'Blue H₂ (CCS)' : 'H₂ Bleu (CCS)',
    green: isEnglish ? 'Green H₂ (Renewable)' : 'H₂ Vert (Renouvelable)',
  };
  return labels[h2Type];
}

/**
 * Get CO2 savings potential by switching from diesel to different technologies
 */
export function getEmissionsSavingsPotential(
  annualKm: number,
  vehicleCount: number,
  dieselConsumption: number = DEFAULT_L_PER_100KM_DIESEL,
  gridCo2Factor: number = 120
): {
  evSavingsPercent: number;
  h2GreenSavingsPercent: number;
  h2BlueSavingsPercent: number;
  biomethaneSavingsPercent: number;
} {
  const totalKm = annualKm * vehicleCount;
  
  // Diesel baseline
  const dieselLiters = (totalKm / 100) * dieselConsumption;
  const dieselCO2 = dieselLiters * KG_CO2_PER_LITER_DIESEL;
  
  // EV emissions
  const evKwh = totalKm * KWH_PER_KM_EV;
  const evMwh = evKwh / 1000;
  const evCO2 = evMwh * gridCo2Factor;
  
  // H2 Green emissions
  const h2Kg = totalKm * KG_H2_PER_KM;
  const h2GreenCO2 = h2Kg * KG_CO2_PER_KG_H2_GREEN;
  const h2BlueCO2 = h2Kg * KG_CO2_PER_KG_H2_BLUE;
  
  // Biomethane emissions
  const biomethaneKg = (totalKm / 100) * KG_BIOMETHANE_PER_100KM;
  const biomethaneCO2 = biomethaneKg * KG_CO2_PER_KG_BIOMETHANE;
  
  return {
    evSavingsPercent: dieselCO2 > 0 ? ((dieselCO2 - evCO2) / dieselCO2) * 100 : 0,
    h2GreenSavingsPercent: dieselCO2 > 0 ? ((dieselCO2 - h2GreenCO2) / dieselCO2) * 100 : 0,
    h2BlueSavingsPercent: dieselCO2 > 0 ? ((dieselCO2 - h2BlueCO2) / dieselCO2) * 100 : 0,
    biomethaneSavingsPercent: dieselCO2 > 0 ? ((dieselCO2 - biomethaneCO2) / dieselCO2) * 100 : 0,
  };
}
