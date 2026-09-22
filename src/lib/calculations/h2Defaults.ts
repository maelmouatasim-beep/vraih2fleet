/**
 * H2 Consumption Defaults by Vehicle PTAC
 * 
 * Reference: NACFE Run on Less 2022, Hydrogen Fuel Cell Electric Trucks
 * These are base consumption values before condition multipliers
 */

// H2 consumption by PTAC (kg/100km)
export const H2_CONSUMPTION_BY_PTAC: Record<string, number> = {
  '3.5T': 3.5,   // Light commercial vehicle
  '7.5T': 5.0,   // Medium truck
  '12T': 6.5,    // Medium-heavy truck
  '19T': 8.0,    // Heavy truck (Class 6-7)
  '26T': 10.0,   // Heavy truck (Class 7)
  '44T': 12.0,   // Tractor trailer (Class 8)
};

// H2 consumption by Vehicle Class (for FlexibleScenarioForm)
export const H2_CONSUMPTION_BY_CLASS: Record<string, number> = {
  'class_2b_3': 2.5,     // Light-duty
  'class_4_5': 4.0,      // Medium-duty
  'class_6_7': 7.0,      // Heavy-duty (single unit)
  'class_8_day': 10.0,   // Class 8 day cab
  'class_8_sleeper': 12.0, // Class 8 sleeper cab (long haul)
};

// Default fallback if PTAC not found
export const DEFAULT_H2_CONSUMPTION = 8.0; // kg/100km

/**
 * Get default H2 consumption based on PTAC
 * @param ptac - Vehicle weight class (e.g., '19T', '44T')
 * @returns Default H2 consumption in kg/100km
 */
export function getDefaultH2ConsumptionByPtac(ptac: string | undefined): number {
  if (!ptac) return DEFAULT_H2_CONSUMPTION;
  return H2_CONSUMPTION_BY_PTAC[ptac] ?? DEFAULT_H2_CONSUMPTION;
}

/**
 * Get default H2 consumption based on Vehicle Class
 * @param vehicleClass - Vehicle class (e.g., 'class_8_day', 'class_6_7')
 * @returns Default H2 consumption in kg/100km
 */
export function getDefaultH2ConsumptionByClass(vehicleClass: string | undefined): number {
  if (!vehicleClass) return DEFAULT_H2_CONSUMPTION;
  return H2_CONSUMPTION_BY_CLASS[vehicleClass] ?? DEFAULT_H2_CONSUMPTION;
}

/**
 * Get reference source for H2 consumption value
 * @returns Source citation string
 */
export function getH2ConsumptionSource(): string {
  return 'NACFE Run on Less 2022';
}
