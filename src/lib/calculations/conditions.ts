import { VehicleConfiguration, MinTemperature, TerrainType, TripType, LoadProfile, PTAC } from './types';
import { getMultiplierById, MultiplierOverride } from './configurableMultipliers';

export interface ConditionMultipliers {
  consumption: number;    // Applied to energy consumption (kWh/km, kg/km, L/km)
  maintenance: number;    // Applied to maintenance costs
  details: ConditionDetail[];
}

export interface ConditionDetail {
  condition: string;
  factor: number;
  description: string;
  source: 'system' | 'expert';
}

// Scientific multipliers based on industry studies
// Sources: AAA Cold Weather Study, DOE Vehicle Technologies, NACFE Run on Less
const TEMPERATURE_MULTIPLIERS: Record<MinTemperature, { factor: number; description: string }> = {
  '-20': { factor: 1.35, description: 'Battery impact at -20°C (+35%)' },
  '-10': { factor: 1.20, description: 'Battery impact at -10°C (+20%)' },
  '0': { factor: 1.08, description: 'Battery impact at 0°C (+8%)' },
  '5': { factor: 1.00, description: 'Optimal temperature range' },
};

const TERRAIN_MULTIPLIERS: Record<TerrainType, { factor: number; description: string }> = {
  'flat': { factor: 1.00, description: 'Flat terrain (baseline)' },
  'hilly': { factor: 1.12, description: 'Hilly terrain (+12%)' },
  'mountainous': { factor: 1.28, description: 'Mountainous terrain (+28%)' },
};

const TRIP_TYPE_MULTIPLIERS: Record<TripType, { factor: number; description: string }> = {
  'urban': { factor: 1.08, description: 'Urban driving (+8% stop/start)' },
  'periurban': { factor: 1.00, description: 'Periurban (baseline)' },
  'long_distance': { factor: 0.92, description: 'Long distance (-8% highway efficiency)' },
  'mixed': { factor: 1.04, description: 'Mixed driving (+4%)' },
};

const LOAD_PROFILE_MULTIPLIERS: Record<LoadProfile, { factor: number; description: string }> = {
  'light': { factor: 0.92, description: 'Light load (-8%)' },
  'medium': { factor: 1.00, description: 'Medium load (baseline)' },
  'heavy': { factor: 1.15, description: 'Heavy load (+15%)' },
};

const PTAC_MULTIPLIERS: Record<PTAC, { factor: number; description: string }> = {
  '3.5T': { factor: 0.75, description: 'Light vehicle (×0.75)' },
  '7.5T': { factor: 0.88, description: 'Medium truck (×0.88)' },
  '12T': { factor: 1.00, description: 'Standard truck (baseline)' },
  '19T': { factor: 1.12, description: 'Heavy truck (×1.12)' },
  '26T': { factor: 1.25, description: 'Very heavy truck (×1.25)' },
  '44T': { factor: 1.45, description: 'Road tractor (×1.45)' },
};

/**
 * Get effective multiplier value, checking overrides first
 */
function getEffectiveMultiplier(
  multiplierId: string,
  systemValue: number,
  overrides?: Record<string, MultiplierOverride>
): { value: number; source: 'system' | 'expert' } {
  const override = overrides?.[multiplierId];
  if (override?.source === 'expert') {
    return { value: override.value, source: 'expert' };
  }
  // Also check configurable multipliers for expert overrides
  const configured = getMultiplierById(multiplierId);
  if (configured && overrides?.[multiplierId]) {
    return { value: overrides[multiplierId].value, source: overrides[multiplierId].source };
  }
  return { value: systemValue, source: 'system' };
}

/**
 * Calculate condition multipliers based on vehicle configuration
 * Uses ADDITIVE formula to avoid extreme values: 1 + Σ(multiplier_i - 1)
 * Now supports expert overrides for each condition
 */
export function calculateConditionMultipliers(
  vehicleConfig?: VehicleConfiguration,
  overrides?: Record<string, MultiplierOverride>
): ConditionMultipliers {
  if (!vehicleConfig) {
    return { consumption: 1.0, maintenance: 1.0, details: [] };
  }

  const details: ConditionDetail[] = [];
  let consumptionDelta = 0;
  let maintenanceDelta = 0;

  // Temperature impact
  const tempMultiplier = TEMPERATURE_MULTIPLIERS[vehicleConfig.minTemperature];
  if (tempMultiplier) {
    const multiplierId = `temp_${vehicleConfig.minTemperature}`;
    const { value, source } = getEffectiveMultiplier(multiplierId, tempMultiplier.factor, overrides);
    
    if (value !== 1.0) {
      consumptionDelta += value - 1;
      details.push({
        condition: `Temperature: ${vehicleConfig.minTemperature}°C`,
        factor: value,
        description: tempMultiplier.description,
        source,
      });
    }
  }

  // Terrain impact (use highest impact terrain)
  if (vehicleConfig.terrainTypes && vehicleConfig.terrainTypes.length > 0) {
    // Find dominant terrain and its effective value
    let maxFactor = 1.0;
    let dominantTerrain: TerrainType | undefined;
    let terrainSource: 'system' | 'expert' = 'system';

    for (const terrain of vehicleConfig.terrainTypes) {
      const systemFactor = TERRAIN_MULTIPLIERS[terrain]?.factor || 1;
      const multiplierId = `terrain_${terrain}`;
      const { value, source } = getEffectiveMultiplier(multiplierId, systemFactor, overrides);
      
      if (value > maxFactor) {
        maxFactor = value;
        dominantTerrain = terrain;
        terrainSource = source;
      }
    }

    if (dominantTerrain && maxFactor !== 1.0) {
      const terrainMult = TERRAIN_MULTIPLIERS[dominantTerrain];
      consumptionDelta += maxFactor - 1;
      maintenanceDelta += (maxFactor - 1) * 0.5; // 50% impact on maintenance
      details.push({
        condition: `Terrain: ${dominantTerrain}`,
        factor: maxFactor,
        description: terrainMult.description,
        source: terrainSource,
      });
    }
  }

  // Trip type impact
  const tripMultiplier = TRIP_TYPE_MULTIPLIERS[vehicleConfig.tripType];
  if (tripMultiplier) {
    const multiplierId = `trip_${vehicleConfig.tripType}`;
    const { value, source } = getEffectiveMultiplier(multiplierId, tripMultiplier.factor, overrides);
    
    if (value !== 1.0) {
      consumptionDelta += value - 1;
      details.push({
        condition: `Trip type: ${vehicleConfig.tripType}`,
        factor: value,
        description: tripMultiplier.description,
        source,
      });
    }
  }

  // Load profile impact
  const loadMultiplier = LOAD_PROFILE_MULTIPLIERS[vehicleConfig.loadProfile];
  if (loadMultiplier) {
    const multiplierId = `load_${vehicleConfig.loadProfile}`;
    const { value, source } = getEffectiveMultiplier(multiplierId, loadMultiplier.factor, overrides);
    
    if (value !== 1.0) {
      consumptionDelta += value - 1;
      details.push({
        condition: `Load: ${vehicleConfig.loadProfile}`,
        factor: value,
        description: loadMultiplier.description,
        source,
      });
    }
  }

  // PTAC impact
  if (vehicleConfig.ptac) {
    const ptacMultiplier = PTAC_MULTIPLIERS[vehicleConfig.ptac];
    if (ptacMultiplier) {
      const multiplierId = `ptac_${vehicleConfig.ptac}`;
      const { value, source } = getEffectiveMultiplier(multiplierId, ptacMultiplier.factor, overrides);
      
      if (value !== 1.0) {
        consumptionDelta += value - 1;
        details.push({
          condition: `PTAC: ${vehicleConfig.ptac}`,
          factor: value,
          description: ptacMultiplier.description,
          source,
        });
      }
    }
  }

  return {
    consumption: Math.max(0.5, 1 + consumptionDelta), // Floor at 0.5 to prevent unrealistic values
    maintenance: Math.max(0.8, 1 + maintenanceDelta), // Floor at 0.8
    details,
  };
}

/**
 * Get default multipliers for quick creation (no conditions applied)
 */
export function getDefaultMultipliers(): ConditionMultipliers {
  return {
    consumption: 1.0,
    maintenance: 1.0,
    details: [],
  };
}
