// ============= Flexible Multi-Technology TCO Types =============

/**
 * Technology types supported for any fleet configuration
 * No assumption about "current" vs "target" - just different technologies
 */
export type TechnologyType = 
  | 'diesel' 
  | 'gasoline'
  | 'bev' 
  | 'fcev' 
  | 'cng' 
  | 'hybrid_diesel'
  | 'hybrid_gasoline'
  | 'phev'
  | 'biomethane'
  | 'other';

/**
 * Vehicle class following North American standards
 */
export type VehicleClass = 
  | 'class_1' // 0-6,000 lbs
  | 'class_2' // 6,001-10,000 lbs  
  | 'class_3' // 10,001-14,000 lbs
  | 'class_4' // 14,001-16,000 lbs
  | 'class_5' // 16,001-19,500 lbs
  | 'class_6' // 19,501-26,000 lbs
  | 'class_7' // 26,001-33,000 lbs
  | 'class_8' // 33,001+ lbs
  | 'custom';

/**
 * Data source types for tracking provenance
 */
export type DataSourceType = 
  | 'quote' // Devis constructeur/fournisseur
  | 'contract' // Contrat signé
  | 'market' // Prix marché / occasion
  | 'current_price' // Prix actuel payé (factures)
  | 'telematics' // Données télématiques
  | 'manufacturer_specs' // Spécifications constructeur
  | 'pilot_test' // Test pilote / flotte existante
  | 'reference' // Données de référence / moyennes
  | 'estimate'; // Estimation

/**
 * Consumption unit based on technology
 */
export type ConsumptionUnit = 'L/100km' | 'kg/100km' | 'kWh/100km';

/**
 * Energy price unit based on technology
 */
export type EnergyPriceUnit = '$/L' | '$/kg' | '$/kWh' | '$/GJ';

/**
 * Helper to get appropriate consumption unit for a technology
 */
export function getConsumptionUnitForTechnology(tech: TechnologyType): ConsumptionUnit {
  switch (tech) {
    case 'diesel':
    case 'gasoline':
    case 'biomethane':
      return 'L/100km';
    case 'fcev':
      return 'kg/100km';
    case 'bev':
    case 'phev':
    case 'hybrid_diesel':
    case 'hybrid_gasoline':
      return 'kWh/100km';
    case 'cng':
      return 'kg/100km'; // CNG is often measured in kg
    default:
      return 'L/100km';
  }
}

/**
 * Helper to get appropriate energy price unit for a technology
 */
export function getEnergyPriceUnitForTechnology(tech: TechnologyType): EnergyPriceUnit {
  switch (tech) {
    case 'diesel':
    case 'gasoline':
    case 'biomethane':
      return '$/L';
    case 'fcev':
    case 'cng':
      return '$/kg';
    case 'bev':
    case 'phev':
    case 'hybrid_diesel':
    case 'hybrid_gasoline':
      return '$/kWh';
    default:
      return '$/L';
  }
}

/**
 * Vehicle configuration within a flexible scenario
 * No defaults - all critical fields must be user-provided
 */
/**
 * Operational conditions configuration
 */
export interface OperationalConditionsConfig {
  temperature?: '-20' | '-10' | '0' | '5';
  terrain?: 'flat' | 'hilly' | 'mountainous';
  tripType?: 'urban' | 'periurban' | 'long_distance' | 'mixed';
  loadProfile?: 'light' | 'medium' | 'heavy';
}

/**
 * Multiplier override structure
 */
export interface MultiplierOverrideValue {
  value: number;
  source: 'system' | 'expert';
}

export interface FlexibleScenarioVehicle {
  id: string;
  
  // Technology & Classification
  technology: TechnologyType;
  vehicleClass: VehicleClass;
  vehicleCount: number;
  customVehicleClassName?: string; // When vehicleClass is 'custom'
  
  // H2 specific - type for emissions calculation
  h2Type?: 'green' | 'blue' | 'grey';
  
  // CAPEX - Required, no defaults
  purchasePrice: number;
  purchasePriceSource: DataSourceType;
  subsidiesPerVehicle: number; // Default: 0
  
  // Consumption - Required, no defaults
  consumption: number;
  consumptionUnit: ConsumptionUnit;
  consumptionSource: DataSourceType;
  
  // Energy Price - Required, no defaults
  energyPrice: number;
  energyPriceUnit: EnergyPriceUnit;
  energyPriceSource: DataSourceType;
  
  // Usage - Required
  annualKm: number;
  
  // Maintenance - Required, no defaults
  annualMaintenanceCost: number;
  maintenanceSource: DataSourceType;
  
  // Infrastructure (optional)
  hasInfrastructure?: boolean;
  infrastructureCost?: number;
  infrastructureShared?: boolean;
  infrastructureAmortizationYears?: number;
  
  // End of life
  residualValuePercent: number; // Default suggestion: 20%
  lifeYears: number; // Default suggestion: 10
  
  // Operational conditions
  operationalConditions?: OperationalConditionsConfig;
  
  // Configurable multiplier overrides
  // Allows experts to override system values for conditions, CO2, etc.
  multiplierOverrides?: Record<string, MultiplierOverrideValue>;
  
  // Documentation
  notes?: string;
  attachments?: string[]; // URLs to uploaded files
}

/**
 * Financial parameters for scenario analysis
 */
export interface FlexibleFinancialParams {
  discountRate: number; // Default suggestion: 5%
  analysisHorizonYears: number; // Default suggestion: 10
  energyInflationRate: number; // Default suggestion: 3%
  maintenanceInflationRate: number; // Default suggestion: 2%
}

/**
 * Advanced operational costs configuration
 */
export interface AdvancedCostsConfig {
  // Downtime costs
  downtimeHoursPerYear?: number;
  downtimeCostPerHour?: number;
  
  // Insurance differentials
  insuranceBaseline?: number; // Annual diesel baseline premium
  insuranceEvPremiumPercent?: number; // Additional % for EV
  insuranceH2PremiumPercent?: number; // Additional % for H2
  
  // Telematics
  telematicsProvider?: 'geotab' | 'samsara' | 'motive' | 'other' | 'none';
  telematicsCostPerVehiclePerMonth?: number;
  
  // Grid demand charges (EV)
  gridDemandCharge?: number; // $/kW monthly
  touEnabled?: boolean;
  touOffPeakRate?: number; // $/kWh
  touPeakRate?: number; // $/kWh
  touOffPeakPercent?: number; // % of charging done off-peak
  
  // Carbon credits
  carbonCreditsEnabled?: boolean;
  carbonCreditProgram?: 'lcfs' | 'zev' | 'other' | 'none';
  carbonCreditPricePerTonne?: number;
  
  // Cold weather impact
  coldWeatherEnabled?: boolean;
  coldWeatherDeratingPercent?: number; // Autonomy loss %
  coldWeatherMonths?: number; // Number of winter months
  
  // Consumption overrides by technology
  consumptionBev?: number; // kWh/100km
  consumptionH2?: number; // kg/100km
  consumptionBiomethane?: number; // kg/100km
  
  // Custom infrastructure cost
  customInfraEnabled?: boolean;
  infrastructureCostPerVehicle?: number; // $
  
  // Hydrogen-specific parameters (FCEV only)
  fcStackReplacementEnabled?: boolean;
  fcStackReplacementCost?: number; // $
  fcStackLifespanYears?: number; // years before replacement
  
  h2InflationEnabled?: boolean;
  h2InflationRate?: number; // %/year (can be negative)
  
  h2InfraScaleEnabled?: boolean;
  h2InfraScaleFactor?: number; // % reduction for large fleets
}

export const TELEMATICS_PROVIDER_LABELS: Record<string, string> = {
  geotab: 'Geotab',
  samsara: 'Samsara',
  motive: 'Motive (ex-KeepTruckin)',
  other: 'Autre',
  none: 'Aucun',
};

export const CARBON_CREDIT_PROGRAM_LABELS: Record<string, string> = {
  lcfs: 'LCFS (Low Carbon Fuel Standard)',
  zev: 'ZEV (Zero Emission Vehicle)',
  other: 'Autre programme',
  none: 'Aucun',
};

export const DEFAULT_ADVANCED_COSTS: AdvancedCostsConfig = {
  downtimeHoursPerYear: 50,
  downtimeCostPerHour: 85,
  insuranceBaseline: 3000,
  insuranceEvPremiumPercent: 10,
  insuranceH2PremiumPercent: 15,
  telematicsProvider: 'none',
  telematicsCostPerVehiclePerMonth: 25,
  gridDemandCharge: 15,
  touEnabled: false,
  touOffPeakRate: 0.06,
  touPeakRate: 0.12,
  touOffPeakPercent: 70,
  carbonCreditsEnabled: false,
  carbonCreditProgram: 'lcfs',
  carbonCreditPricePerTonne: 50,
  coldWeatherEnabled: false,
  coldWeatherDeratingPercent: 20,
  coldWeatherMonths: 4,
  // Consumption overrides
  consumptionBev: 120,
  consumptionH2: 8,
  consumptionBiomethane: 28,
  // Custom infrastructure
  customInfraEnabled: false,
  infrastructureCostPerVehicle: 0,
  // Hydrogen-specific defaults
  fcStackReplacementEnabled: false,
  fcStackReplacementCost: 50000,
  fcStackLifespanYears: 8,
  h2InflationEnabled: false,
  h2InflationRate: -2, // Expected decrease with scale
  h2InfraScaleEnabled: false,
  h2InfraScaleFactor: 15,
};

/**
 * Complete flexible scenario structure
 * Supports any combination of technologies without forcing a "transition" workflow
 */
export interface FlexibleScenario {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  region: string;
  
  // Fleet composition - array of vehicle configurations
  vehicles: FlexibleScenarioVehicle[];
  
  // Financial parameters
  financialParams: FlexibleFinancialParams;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Form data for creating a flexible scenario
 */
export interface CreateFlexibleScenarioForm {
  name: string;
  description?: string;
  region: string;
  vehicles: FlexibleScenarioVehicle[];
  financialParams: FlexibleFinancialParams;
  advancedCosts?: AdvancedCostsConfig;
  /** Scenario-level multiplier overrides (CO2 factors, infrastructure costs) */
  scenarioMultiplierOverrides?: Record<string, MultiplierOverrideValue>;
}

// ============= Labels for UI =============

export const TECHNOLOGY_LABELS: Record<TechnologyType, string> = {
  diesel: 'Diesel',
  gasoline: 'Gasoline / Essence',
  bev: 'BEV (Électrique batterie)',
  fcev: 'FCEV (Hydrogène)',
  cng: 'CNG / GNV (Gaz naturel)',
  hybrid_diesel: 'Hybride diesel',
  hybrid_gasoline: 'Hybride essence',
  phev: 'PHEV (Hybride rechargeable)',
  biomethane: 'Biométhane',
  other: 'Autre',
};

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  class_1: 'Class 1 (0-2.7t / 0-6,000 lbs)',
  class_2: 'Class 2 (2.7-4.5t / 6,001-10,000 lbs)',
  class_3: 'Class 3 (4.5-6.4t / 10,001-14,000 lbs)',
  class_4: 'Class 4 (6.4-7.3t / 14,001-16,000 lbs)',
  class_5: 'Class 5 (7.3-8.8t / 16,001-19,500 lbs)',
  class_6: 'Class 6 (8.8-11.8t / 19,501-26,000 lbs)',
  class_7: 'Class 7 (11.8-15t / 26,001-33,000 lbs)',
  class_8: 'Class 8 (15t+ / 33,001+ lbs)',
  custom: 'Personnalisé',
};

export const DATA_SOURCE_LABELS: Record<DataSourceType, string> = {
  quote: 'Devis fournisseur',
  contract: 'Contrat signé',
  market: 'Prix marché',
  current_price: 'Prix actuel (factures)',
  telematics: 'Données télématiques',
  manufacturer_specs: 'Specs constructeur',
  pilot_test: 'Test pilote',
  reference: 'Données de référence',
  estimate: 'Estimation',
};

// English labels
export const TECHNOLOGY_LABELS_EN: Record<TechnologyType, string> = {
  diesel: 'Diesel',
  gasoline: 'Gasoline',
  bev: 'BEV (Battery Electric)',
  fcev: 'FCEV (Hydrogen Fuel Cell)',
  cng: 'CNG (Compressed Natural Gas)',
  hybrid_diesel: 'Diesel Hybrid',
  hybrid_gasoline: 'Gasoline Hybrid',
  phev: 'PHEV (Plug-in Hybrid)',
  biomethane: 'Biomethane',
  other: 'Other',
};

export const VEHICLE_CLASS_LABELS_EN: Record<VehicleClass, string> = {
  class_1: 'Class 1 (0-6,000 lbs)',
  class_2: 'Class 2 (6,001-10,000 lbs)',
  class_3: 'Class 3 (10,001-14,000 lbs)',
  class_4: 'Class 4 (14,001-16,000 lbs)',
  class_5: 'Class 5 (16,001-19,500 lbs)',
  class_6: 'Class 6 (19,501-26,000 lbs)',
  class_7: 'Class 7 (26,001-33,000 lbs)',
  class_8: 'Class 8 (33,001+ lbs)',
  custom: 'Custom',
};

export const DATA_SOURCE_LABELS_EN: Record<DataSourceType, string> = {
  quote: 'Supplier quote',
  contract: 'Signed contract',
  market: 'Market price',
  current_price: 'Current price (invoices)',
  telematics: 'Telematics data',
  manufacturer_specs: 'Manufacturer specs',
  pilot_test: 'Pilot test',
  reference: 'Reference data',
  estimate: 'Estimate',
};

/**
 * Default financial parameters (suggestions only, not auto-filled)
 */
export const DEFAULT_FINANCIAL_PARAMS: FlexibleFinancialParams = {
  discountRate: 5,
  analysisHorizonYears: 10,
  energyInflationRate: 3,
  maintenanceInflationRate: 2,
};

/**
 * Create an empty vehicle configuration for the form
 */
export function createEmptyVehicle(id: string): Partial<FlexibleScenarioVehicle> {
  return {
    id,
    technology: 'diesel',
    vehicleClass: 'class_8',
    vehicleCount: 1,
    subsidiesPerVehicle: 0,
    residualValuePercent: 20,
    lifeYears: 10,
    hasInfrastructure: false,
    infrastructureShared: false,
    // All other fields intentionally undefined to force user input
  };
}

/**
 * Convert AdvancedCostsConfig to FleetComposition-compatible structures
 * Used to bridge flexible scenario form with TCO calculation engine
 */
export function convertAdvancedCostsToFleetConfig(advancedCosts?: AdvancedCostsConfig): {
  operationalCosts?: import('./types').OperationalCostsConfig;
  energyCosts?: import('./types').EnergyCostsConfig;
  environmental?: import('./types').EnvironmentalConfig;
} {
  if (!advancedCosts || Object.keys(advancedCosts).length === 0) {
    return {};
  }

  const result: ReturnType<typeof convertAdvancedCostsToFleetConfig> = {};

  // Operational costs
  const hasDowntime = advancedCosts.downtimeHoursPerYear !== undefined && advancedCosts.downtimeCostPerHour !== undefined;
  const hasInsurance = advancedCosts.insuranceBaseline !== undefined;
  const hasTelematics = advancedCosts.telematicsProvider && advancedCosts.telematicsProvider !== 'none';

  if (hasDowntime || hasInsurance || hasTelematics) {
    result.operationalCosts = {};

    if (hasDowntime) {
      result.operationalCosts.downtime = {
        hoursPerYear: advancedCosts.downtimeHoursPerYear!,
        costPerHour: advancedCosts.downtimeCostPerHour!,
      };
    }

    if (hasInsurance) {
      result.operationalCosts.insurance = {
        dieselBaseline: advancedCosts.insuranceBaseline!,
        evPremium: (advancedCosts.insuranceBaseline! * (advancedCosts.insuranceEvPremiumPercent || 0)) / 100,
        h2Premium: (advancedCosts.insuranceBaseline! * (advancedCosts.insuranceH2PremiumPercent || 0)) / 100,
      };
    }

    if (hasTelematics) {
      result.operationalCosts.telematics = {
        provider: advancedCosts.telematicsProvider === 'motive' ? 'other' : advancedCosts.telematicsProvider as 'geotab' | 'samsara' | 'other' | 'none',
        costPerVehiclePerMonth: advancedCosts.telematicsCostPerVehiclePerMonth || 25,
      };
    }
  }

  // Energy costs (grid charges)
  if (advancedCosts.gridDemandCharge !== undefined) {
    result.energyCosts = {
      gridCharges: {
        demandCharge: advancedCosts.gridDemandCharge,
      },
    };

    if (advancedCosts.touEnabled) {
      result.energyCosts.gridCharges!.touRates = {
        offPeak: advancedCosts.touOffPeakRate || 0.06,
        midPeak: (advancedCosts.touOffPeakRate || 0.06 + advancedCosts.touPeakRate || 0.12) / 2,
        onPeak: advancedCosts.touPeakRate || 0.12,
        offPeakPercentage: advancedCosts.touOffPeakPercent || 70,
      };
    }
  }

  // Environmental config
  const hasCarbonCredits = advancedCosts.carbonCreditsEnabled && advancedCosts.carbonCreditPricePerTonne !== undefined;
  const hasColdWeather = advancedCosts.coldWeatherEnabled && advancedCosts.coldWeatherDeratingPercent !== undefined;

  if (hasCarbonCredits || hasColdWeather) {
    result.environmental = {};

    if (hasCarbonCredits) {
      result.environmental.carbonCredits = {
        enabled: true,
        pricePerTonne: advancedCosts.carbonCreditPricePerTonne!,
        program: advancedCosts.carbonCreditProgram === 'lcfs' ? 'LCFS' : 
                 advancedCosts.carbonCreditProgram === 'zev' ? 'ZEV' : 'none',
      };
    }

    if (hasColdWeather) {
      result.environmental.coldWeather = {
        enabled: true,
        averageDeratingPercent: advancedCosts.coldWeatherDeratingPercent!,
        winterMonths: advancedCosts.coldWeatherMonths || 4,
      };
    }
  }

  return result;
}
