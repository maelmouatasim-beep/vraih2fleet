/**
 * Maps form values to multiplier IDs for the configurable multipliers system
 */

import { MultiplierCategory } from './configurableMultipliers';

export interface ConditionMultiplierMapping {
  category: MultiplierCategory;
  key: string;
  multiplierId: string;
}

/**
 * Get the multiplier ID for a temperature value
 */
export function getTemperatureMultiplierId(minTemperature: string): string {
  return `temp_${minTemperature}`;
}

/**
 * Get the multiplier key for a temperature value (just the key part)
 */
export function getTemperatureKey(minTemperature: string): string {
  return minTemperature;
}

/**
 * Get the multiplier ID for a terrain type
 */
export function getTerrainMultiplierId(terrain: string): string {
  return `terrain_${terrain}`;
}

/**
 * Get the multiplier key for a terrain type
 */
export function getTerrainKey(terrain: string): string {
  return terrain;
}

/**
 * Get the multiplier ID for a trip type
 */
export function getTripTypeMultiplierId(tripType: string): string {
  return `trip_${tripType}`;
}

/**
 * Get the multiplier key for a trip type
 */
export function getTripTypeKey(tripType: string): string {
  return tripType;
}

/**
 * Get the multiplier ID for a load profile
 */
export function getLoadProfileMultiplierId(loadProfile: string): string {
  return `load_${loadProfile}`;
}

/**
 * Get the multiplier key for a load profile
 */
export function getLoadProfileKey(loadProfile: string): string {
  return loadProfile;
}

/**
 * Get the multiplier ID for a PTAC value
 */
export function getPtacMultiplierId(ptac: string): string {
  return `ptac_${ptac}`;
}

/**
 * Get the multiplier key for a PTAC value
 */
export function getPtacKey(ptac: string): string {
  return ptac;
}

/**
 * Get all condition mappings for a given scenario configuration
 */
export function getAllConditionMappings(config: {
  minTemperature?: string;
  terrainTypes?: string[];
  tripType?: string;
  loadProfile?: string;
  ptac?: string;
}): ConditionMultiplierMapping[] {
  const mappings: ConditionMultiplierMapping[] = [];

  if (config.minTemperature) {
    mappings.push({
      category: 'temperature',
      key: config.minTemperature,
      multiplierId: getTemperatureMultiplierId(config.minTemperature),
    });
  }

  if (config.terrainTypes) {
    for (const terrain of config.terrainTypes) {
      mappings.push({
        category: 'terrain',
        key: terrain,
        multiplierId: getTerrainMultiplierId(terrain),
      });
    }
  }

  if (config.tripType) {
    mappings.push({
      category: 'trip_type',
      key: config.tripType,
      multiplierId: getTripTypeMultiplierId(config.tripType),
    });
  }

  if (config.loadProfile) {
    mappings.push({
      category: 'load',
      key: config.loadProfile,
      multiplierId: getLoadProfileMultiplierId(config.loadProfile),
    });
  }

  if (config.ptac) {
    mappings.push({
      category: 'ptac',
      key: config.ptac,
      multiplierId: getPtacMultiplierId(config.ptac),
    });
  }

  return mappings;
}
