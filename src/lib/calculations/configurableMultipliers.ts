/**
 * Centralized registry of all configurable calculation multipliers
 * Allows experts to either use system values or input their own
 */

export type MultiplierCategory = 
  | 'temperature' 
  | 'terrain' 
  | 'trip_type' 
  | 'load' 
  | 'ptac' 
  | 'co2_emissions' 
  | 'infrastructure' 
  | 'consumption';

export type MultiplierSource = 'system' | 'expert';

export interface ConfigurableMultiplier {
  id: string;
  category: MultiplierCategory;
  key: string;
  systemValue: number;
  unit: string;
  impactType: 'percent' | 'absolute' | 'factor';
  impactDescriptionKey: string; // i18n key for description
  sourceReference: string; // Study/source name
  minValue: number;
  maxValue: number;
  affectsConsumption: boolean;
  affectsMaintenance: boolean;
}

export interface MultiplierOverride {
  value: number;
  source: MultiplierSource;
}

// ============= TEMPERATURE MULTIPLIERS =============
const TEMPERATURE_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'temp_-20',
    category: 'temperature',
    key: '-20',
    systemValue: 1.35,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.temp.minus20',
    sourceReference: 'AAA Cold Weather Study 2023',
    minValue: 1.0,
    maxValue: 2.0,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'temp_-10',
    category: 'temperature',
    key: '-10',
    systemValue: 1.20,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.temp.minus10',
    sourceReference: 'AAA Cold Weather Study 2023',
    minValue: 1.0,
    maxValue: 1.8,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'temp_0',
    category: 'temperature',
    key: '0',
    systemValue: 1.08,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.temp.zero',
    sourceReference: 'AAA Cold Weather Study 2023',
    minValue: 1.0,
    maxValue: 1.5,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'temp_5',
    category: 'temperature',
    key: '5',
    systemValue: 1.0,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.temp.optimal',
    sourceReference: 'AAA Cold Weather Study 2023',
    minValue: 0.9,
    maxValue: 1.2,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
];

// ============= TERRAIN MULTIPLIERS =============
const TERRAIN_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'terrain_flat',
    category: 'terrain',
    key: 'flat',
    systemValue: 1.0,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.terrain.flat',
    sourceReference: 'DOE Vehicle Technologies Office',
    minValue: 0.9,
    maxValue: 1.1,
    affectsConsumption: true,
    affectsMaintenance: true,
  },
  {
    id: 'terrain_hilly',
    category: 'terrain',
    key: 'hilly',
    systemValue: 1.12,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.terrain.hilly',
    sourceReference: 'DOE Vehicle Technologies Office',
    minValue: 1.0,
    maxValue: 1.4,
    affectsConsumption: true,
    affectsMaintenance: true,
  },
  {
    id: 'terrain_mountainous',
    category: 'terrain',
    key: 'mountainous',
    systemValue: 1.28,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.terrain.mountainous',
    sourceReference: 'DOE Vehicle Technologies Office',
    minValue: 1.1,
    maxValue: 1.6,
    affectsConsumption: true,
    affectsMaintenance: true,
  },
];

// ============= TRIP TYPE MULTIPLIERS =============
const TRIP_TYPE_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'trip_urban',
    category: 'trip_type',
    key: 'urban',
    systemValue: 1.08,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.trip.urban',
    sourceReference: 'NACFE Run on Less Study',
    minValue: 1.0,
    maxValue: 1.3,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'trip_periurban',
    category: 'trip_type',
    key: 'periurban',
    systemValue: 1.0,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.trip.periurban',
    sourceReference: 'NACFE Run on Less Study',
    minValue: 0.9,
    maxValue: 1.2,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'trip_long_distance',
    category: 'trip_type',
    key: 'long_distance',
    systemValue: 0.92,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.trip.longDistance',
    sourceReference: 'NACFE Run on Less Study',
    minValue: 0.8,
    maxValue: 1.1,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'trip_mixed',
    category: 'trip_type',
    key: 'mixed',
    systemValue: 1.04,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.trip.mixed',
    sourceReference: 'NACFE Run on Less Study',
    minValue: 0.9,
    maxValue: 1.2,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
];

// ============= LOAD PROFILE MULTIPLIERS =============
const LOAD_PROFILE_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'load_light',
    category: 'load',
    key: 'light',
    systemValue: 0.92,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.load.light',
    sourceReference: 'DOE Vehicle Technologies Office',
    minValue: 0.8,
    maxValue: 1.0,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'load_medium',
    category: 'load',
    key: 'medium',
    systemValue: 1.0,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.load.medium',
    sourceReference: 'DOE Vehicle Technologies Office',
    minValue: 0.9,
    maxValue: 1.1,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'load_heavy',
    category: 'load',
    key: 'heavy',
    systemValue: 1.15,
    unit: '%',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.load.heavy',
    sourceReference: 'DOE Vehicle Technologies Office',
    minValue: 1.0,
    maxValue: 1.4,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
];

// ============= PTAC MULTIPLIERS =============
const PTAC_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'ptac_3.5T',
    category: 'ptac',
    key: '3.5T',
    systemValue: 0.75,
    unit: '×',
    impactType: 'factor',
    impactDescriptionKey: 'multipliers.ptac.light',
    sourceReference: 'European Truck Standards',
    minValue: 0.5,
    maxValue: 1.0,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'ptac_7.5T',
    category: 'ptac',
    key: '7.5T',
    systemValue: 0.88,
    unit: '×',
    impactType: 'factor',
    impactDescriptionKey: 'multipliers.ptac.medium',
    sourceReference: 'European Truck Standards',
    minValue: 0.7,
    maxValue: 1.0,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'ptac_12T',
    category: 'ptac',
    key: '12T',
    systemValue: 1.0,
    unit: '×',
    impactType: 'factor',
    impactDescriptionKey: 'multipliers.ptac.standard',
    sourceReference: 'European Truck Standards',
    minValue: 0.8,
    maxValue: 1.2,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'ptac_19T',
    category: 'ptac',
    key: '19T',
    systemValue: 1.12,
    unit: '×',
    impactType: 'factor',
    impactDescriptionKey: 'multipliers.ptac.heavy',
    sourceReference: 'European Truck Standards',
    minValue: 1.0,
    maxValue: 1.4,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'ptac_26T',
    category: 'ptac',
    key: '26T',
    systemValue: 1.25,
    unit: '×',
    impactType: 'factor',
    impactDescriptionKey: 'multipliers.ptac.veryHeavy',
    sourceReference: 'European Truck Standards',
    minValue: 1.1,
    maxValue: 1.5,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'ptac_44T',
    category: 'ptac',
    key: '44T',
    systemValue: 1.45,
    unit: '×',
    impactType: 'factor',
    impactDescriptionKey: 'multipliers.ptac.roadTractor',
    sourceReference: 'European Truck Standards',
    minValue: 1.2,
    maxValue: 1.8,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
];

// ============= CO2 EMISSION FACTORS =============
const CO2_EMISSION_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'co2_diesel_per_liter',
    category: 'co2_emissions',
    key: 'diesel_per_liter',
    systemValue: 2.68,
    unit: 'kg CO₂/L',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.co2.dieselPerLiter',
    sourceReference: 'ECCC National Inventory 2025',
    minValue: 2.4,
    maxValue: 3.0,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'co2_h2_green',
    category: 'co2_emissions',
    key: 'h2_green',
    systemValue: 0.5,
    unit: 'kg CO₂/kg H₂',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.co2.h2Green',
    sourceReference: 'IEA Hydrogen Report 2024',
    minValue: 0.0,
    maxValue: 1.5,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'co2_h2_blue',
    category: 'co2_emissions',
    key: 'h2_blue',
    systemValue: 3.0,
    unit: 'kg CO₂/kg H₂',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.co2.h2Blue',
    sourceReference: 'IEA Hydrogen Report 2024',
    minValue: 1.5,
    maxValue: 5.0,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'co2_h2_grey',
    category: 'co2_emissions',
    key: 'h2_grey',
    systemValue: 9.3,
    unit: 'kg CO₂/kg H₂',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.co2.h2Grey',
    sourceReference: 'IEA Hydrogen Report 2024',
    minValue: 8.0,
    maxValue: 12.0,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'co2_biomethane',
    category: 'co2_emissions',
    key: 'biomethane',
    systemValue: 0.5,
    unit: 'kg CO₂/kg',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.co2.biomethane',
    sourceReference: 'European Biogas Association 2024',
    minValue: 0.0,
    maxValue: 1.5,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'co2_grid_electricity',
    category: 'co2_emissions',
    key: 'grid_electricity',
    systemValue: 120,
    unit: 'g CO₂/kWh',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.co2.gridElectricity',
    sourceReference: 'Canada National Average 2024',
    minValue: 0,
    maxValue: 800,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
];

// ============= BASE CONSUMPTION =============
const BASE_CONSUMPTION_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'consumption_diesel_default',
    category: 'consumption',
    key: 'diesel_default',
    systemValue: 35.7,
    unit: 'L/100km',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.consumption.diesel',
    sourceReference: 'NRCan Fuel Consumption Guide 2024',
    minValue: 20,
    maxValue: 60,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'consumption_bev_default',
    category: 'consumption',
    key: 'bev_default',
    systemValue: 120,
    unit: 'kWh/100km',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.consumption.bev',
    sourceReference: 'DOE Vehicle Technologies 2024',
    minValue: 60,
    maxValue: 250,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
  {
    id: 'consumption_h2_default',
    category: 'consumption',
    key: 'h2_default',
    systemValue: 8.0,
    unit: 'kg/100km',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.consumption.h2',
    sourceReference: 'California Fuel Cell Partnership 2024',
    minValue: 4,
    maxValue: 15,
    affectsConsumption: true,
    affectsMaintenance: false,
  },
];

// ============= INFRASTRUCTURE CONSTANTS =============
const INFRASTRUCTURE_MULTIPLIERS: ConfigurableMultiplier[] = [
  {
    id: 'infra_bev_charger_slow_capex',
    category: 'infrastructure',
    key: 'bev_charger_slow_capex',
    systemValue: 3000,
    unit: '$',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.infra.bevChargerSlowCapex',
    sourceReference: 'EVSE Database 2025',
    minValue: 1000,
    maxValue: 10000,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'infra_bev_charger_fast_capex',
    category: 'infrastructure',
    key: 'bev_charger_fast_capex',
    systemValue: 60000,
    unit: '$',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.infra.bevChargerFastCapex',
    sourceReference: 'EVSE Database 2025',
    minValue: 30000,
    maxValue: 150000,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'infra_bev_charger_ultra_capex',
    category: 'infrastructure',
    key: 'bev_charger_ultra_capex',
    systemValue: 150000,
    unit: '$',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.infra.bevChargerUltraCapex',
    sourceReference: 'EVSE Database 2025',
    minValue: 80000,
    maxValue: 300000,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'infra_h2_station_small_capex',
    category: 'infrastructure',
    key: 'h2_station_small_capex',
    systemValue: 1500000,
    unit: '$',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.infra.h2StationSmallCapex',
    sourceReference: 'DOE Hydrogen Program 2024',
    minValue: 800000,
    maxValue: 3000000,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'infra_h2_station_large_capex',
    category: 'infrastructure',
    key: 'h2_station_large_capex',
    systemValue: 4000000,
    unit: '$',
    impactType: 'absolute',
    impactDescriptionKey: 'multipliers.infra.h2StationLargeCapex',
    sourceReference: 'DOE Hydrogen Program 2024',
    minValue: 2000000,
    maxValue: 8000000,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'infra_h2_opex_percent',
    category: 'infrastructure',
    key: 'h2_opex_percent',
    systemValue: 5,
    unit: '%/year',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.infra.h2OpexPercent',
    sourceReference: 'DOE Hydrogen Program 2024',
    minValue: 2,
    maxValue: 10,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
  {
    id: 'infra_bev_opex_percent',
    category: 'infrastructure',
    key: 'bev_opex_percent',
    systemValue: 3,
    unit: '%/year',
    impactType: 'percent',
    impactDescriptionKey: 'multipliers.infra.bevOpexPercent',
    sourceReference: 'EVSE Database 2025',
    minValue: 1,
    maxValue: 8,
    affectsConsumption: false,
    affectsMaintenance: false,
  },
];

// ============= COMBINED REGISTRY =============
export const SYSTEM_MULTIPLIERS: ConfigurableMultiplier[] = [
  ...TEMPERATURE_MULTIPLIERS,
  ...TERRAIN_MULTIPLIERS,
  ...TRIP_TYPE_MULTIPLIERS,
  ...LOAD_PROFILE_MULTIPLIERS,
  ...PTAC_MULTIPLIERS,
  ...CO2_EMISSION_MULTIPLIERS,
  ...BASE_CONSUMPTION_MULTIPLIERS,
  ...INFRASTRUCTURE_MULTIPLIERS,
];

// ============= HELPER FUNCTIONS =============

/**
 * Get a multiplier by its ID
 */
export function getMultiplierById(id: string): ConfigurableMultiplier | undefined {
  return SYSTEM_MULTIPLIERS.find(m => m.id === id);
}

/**
 * Get all multipliers for a given category
 */
export function getMultipliersByCategory(category: MultiplierCategory): ConfigurableMultiplier[] {
  return SYSTEM_MULTIPLIERS.filter(m => m.category === category);
}

/**
 * Get multiplier by category and key (e.g., 'temperature' + '-10')
 */
export function getMultiplierByCategoryAndKey(category: MultiplierCategory, key: string): ConfigurableMultiplier | undefined {
  return SYSTEM_MULTIPLIERS.find(m => m.category === category && m.key === key);
}

/**
 * Get the effective value considering overrides
 */
export function getEffectiveMultiplierValue(
  id: string,
  overrides?: Record<string, MultiplierOverride>
): { value: number; source: MultiplierSource } {
  const multiplier = getMultiplierById(id);
  if (!multiplier) {
    return { value: 1.0, source: 'system' };
  }

  const override = overrides?.[id];
  if (override && override.source === 'expert') {
    return { value: override.value, source: 'expert' };
  }

  return { value: multiplier.systemValue, source: 'system' };
}

/**
 * Format impact for display (e.g., "+35%" or "×1.45")
 */
export function formatMultiplierImpact(multiplier: ConfigurableMultiplier, value?: number): string {
  const displayValue = value ?? multiplier.systemValue;
  
  if (multiplier.impactType === 'percent') {
    const percentChange = Math.round((displayValue - 1) * 100);
    if (percentChange >= 0) {
      return `+${percentChange}%`;
    }
    return `${percentChange}%`;
  }
  
  if (multiplier.impactType === 'factor') {
    return `×${displayValue.toFixed(2)}`;
  }
  
  // Absolute values
  return `${displayValue} ${multiplier.unit}`;
}

/**
 * Get category label key for i18n
 */
export function getCategoryLabelKey(category: MultiplierCategory): string {
  const keys: Record<MultiplierCategory, string> = {
    temperature: 'multipliers.categories.temperature',
    terrain: 'multipliers.categories.terrain',
    trip_type: 'multipliers.categories.tripType',
    load: 'multipliers.categories.load',
    ptac: 'multipliers.categories.ptac',
    co2_emissions: 'multipliers.categories.co2Emissions',
    infrastructure: 'multipliers.categories.infrastructure',
    consumption: 'multipliers.categories.consumption',
  };
  return keys[category];
}
