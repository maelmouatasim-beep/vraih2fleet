// ============= TCO Calculation Engine =============
// Re-export all types
export * from './types';

// Re-export calculation functions
export { calculateCapex, calculateResidualValue } from './capex';
export { 
  calculateOPEXByYear, 
  calculateTotalOPEX, 
  calculatePVOPEX 
} from './opex';
export { 
  calculateAnnualEmissions, 
  calculateTotalEmissions, 
  kgToTonnes 
} from './emissions';
export { 
  calculateInfrastructure,
  calculateEVChargers,
  calculateH2Stations,
  calculateTotalInfrastructure,
  EV_CHARGER_COSTS,
  H2_STATION_COSTS,
} from './infrastructure';
export type {
  ChargingSpeed,
  H2StationCapacity,
  EVChargersParams,
  EVChargersResult,
  H2StationsParams,
  H2StationsResult,
  TotalInfrastructureParams,
  TotalInfrastructureResult,
} from './infrastructure';
export { 
  calculateTCO, 
  calculateNPV, 
  compareWithBaseline 
} from './tco';
export {
  calculateFlexibleTCO,
  calculateFlexibleTCOWithDetails,
  convertVehiclesToFleetComposition,
  buildReferenceDataFromVehicles,
} from './flexibleTCO';
export {
  calculateConditionMultipliers,
  getDefaultMultipliers,
} from './conditions';
export type { ConditionMultipliers, ConditionDetail } from './conditions';

// Fleet mix utilities for mixed strategies
export {
  calculateFleetFromMix,
  getEffectiveFleetComposition,
  getPowertrainDistribution,
  isMixedStrategy,
} from './fleetMix';

// H2 consumption defaults
export {
  getDefaultH2ConsumptionByPtac,
  getDefaultH2ConsumptionByClass,
  getH2ConsumptionSource,
  H2_CONSUMPTION_BY_PTAC,
  H2_CONSUMPTION_BY_CLASS,
  DEFAULT_H2_CONSUMPTION,
} from './h2Defaults';
