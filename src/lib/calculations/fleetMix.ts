import { Scenario, FleetComposition, TargetPowertrain, VehicleConfiguration } from './types';

/**
 * Calculate fleet composition based on targetPowertrainMix
 * This converts the percentage-based mix into actual vehicle counts
 */
export function calculateFleetFromMix(
  vehicleConfiguration: VehicleConfiguration | undefined,
  totalVehicles: number,
  annualKm: number
): FleetComposition {
  if (!vehicleConfiguration?.targetPowertrains || vehicleConfiguration.targetPowertrains.length === 0) {
    // Fallback to all EV if no configuration
    return {
      diesel: { count: 0, annualKm },
      ev: { count: totalVehicles, annualKm },
      hydrogen: { count: 0, annualKm },
    };
  }

  const mix = vehicleConfiguration.targetPowertrainMix;
  const powertrains = vehicleConfiguration.targetPowertrains;

  // Calculate counts based on mix percentages
  // Diesel stays as diesel, BEV and PHEV both count as EV (but PHEV tracked separately), FCEV as hydrogen
  const dieselPercent = mix.diesel || 0;
  const bevPercent = mix.bev || 0;
  const phevPercent = mix.phev || 0;
  const evPercent = bevPercent + phevPercent;
  const h2Percent = mix.fcev || 0;
  // biomethane is treated as diesel for now (similar fuel infrastructure)
  const bioPercent = mix.biomethane || 0;

  // Calculate vehicle counts (rounding to nearest integer)
  let dieselCount = Math.round(totalVehicles * (dieselPercent + bioPercent) / 100);
  let evCount = Math.round(totalVehicles * evPercent / 100);
  let h2Count = Math.round(totalVehicles * h2Percent / 100);
  
  // Adjust for rounding errors - ensure total equals totalVehicles
  const allocated = dieselCount + evCount + h2Count;
  if (allocated !== totalVehicles) {
    // Add/subtract difference to largest group
    const diff = totalVehicles - allocated;
    const maxCount = Math.max(dieselCount, evCount, h2Count);
    if (evCount === maxCount) {
      evCount += diff;
    } else if (h2Count === maxCount) {
      h2Count += diff;
    } else {
      dieselCount += diff;
    }
  }

  // Calculate PHEV ratio within the EV fleet (for hybrid 60/40 calculation)
  const phevRatio = evPercent > 0 ? phevPercent / evPercent : 0;

  return {
    diesel: { count: dieselCount, annualKm },
    ev: { count: evCount, annualKm },
    hydrogen: { count: h2Count, annualKm },
    phevRatio, // Track PHEV ratio for OPEX calculation
  };
}

/**
 * Get the effective fleet composition for a scenario
 * Uses targetPowertrainMix if available, otherwise uses fleetComposition directly
 */
export function getEffectiveFleetComposition(scenario: Scenario): FleetComposition {
  const { vehicleConfiguration, fleetComposition } = scenario;

  // If we have a vehicle configuration with powertrain mix, use it
  if (vehicleConfiguration?.targetPowertrains && vehicleConfiguration.targetPowertrains.length > 0) {
    const totalVehicles = vehicleConfiguration.vehicleCount;
    const annualKm = vehicleConfiguration.annualKm;
    return calculateFleetFromMix(vehicleConfiguration, totalVehicles, annualKm);
  }

  // Otherwise use the direct fleet composition
  return fleetComposition;
}

/**
 * Get powertrain distribution summary for display
 */
export function getPowertrainDistribution(
  vehicleConfiguration: VehicleConfiguration | undefined
): { powertrain: TargetPowertrain; percent: number; count: number }[] {
  if (!vehicleConfiguration?.targetPowertrains || vehicleConfiguration.targetPowertrains.length === 0) {
    return [];
  }

  const totalVehicles = vehicleConfiguration.vehicleCount;
  const mix = vehicleConfiguration.targetPowertrainMix;

  return vehicleConfiguration.targetPowertrains.map(powertrain => ({
    powertrain,
    percent: mix[powertrain] || 0,
    count: Math.round(totalVehicles * (mix[powertrain] || 0) / 100),
  }));
}

/**
 * Check if scenario uses a mixed strategy (multiple powertrains)
 */
export function isMixedStrategy(vehicleConfiguration: VehicleConfiguration | undefined): boolean {
  return (vehicleConfiguration?.targetPowertrains?.length ?? 0) > 1;
}
