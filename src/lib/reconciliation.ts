// Pure reconciliation calculation functions - extracted for testability

export interface ReconciliationInput {
  realKm: number;
  predictedKm: number;
  realConsumption: number;
  predictedConsumption: number;
}

export interface ReconciliationResult {
  kmDeviation: number;
  consumptionDeviation: number;
  status: 'good' | 'warning' | 'alert';
}

/**
 * Calculate percentage deviation between real and predicted values
 * @returns Deviation as percentage (positive = real > predicted)
 */
export function calculateDeviation(real: number, predicted: number): number {
  if (predicted === 0) return 0;
  return Math.round(((real - predicted) / predicted) * 100 * 10) / 10;
}

/**
 * Determine status based on deviation threshold
 * - good: <= 5%
 * - warning: 5% < deviation <= 15%
 * - alert: > 15%
 */
export function getDeviationStatus(deviation: number): 'good' | 'warning' | 'alert' {
  const abs = Math.abs(deviation);
  if (abs > 15) return 'alert';
  if (abs > 5) return 'warning';
  return 'good';
}

/**
 * Check if deviation is significant enough to generate an alert
 */
export function shouldGenerateAlert(deviation: number): boolean {
  return Math.abs(deviation) > 15;
}

/**
 * Get the worst status between km and consumption deviations
 */
export function getCombinedStatus(
  kmDeviation: number,
  consumptionDeviation: number
): 'good' | 'warning' | 'alert' {
  const kmStatus = getDeviationStatus(kmDeviation);
  const consumptionStatus = getDeviationStatus(consumptionDeviation);
  
  if (kmStatus === 'alert' || consumptionStatus === 'alert') return 'alert';
  if (kmStatus === 'warning' || consumptionStatus === 'warning') return 'warning';
  return 'good';
}

/**
 * Calculate weighted average deviation across multiple vehicle types
 */
export function calculateWeightedDeviation(
  items: Array<{ deviation: number; count: number }>
): number {
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  if (totalCount === 0) return 0;
  
  const weightedSum = items.reduce(
    (sum, item) => sum + item.deviation * item.count,
    0
  );
  
  return Math.round((weightedSum / totalCount) * 10) / 10;
}

/**
 * Default fuel consumption values by vehicle type (L/100km)
 */
export const DEFAULT_CONSUMPTION: Record<string, number> = {
  'Light Van': 15,
  'Medium Truck': 25,
  'Heavy Truck': 35,
  default: 25,
};

/**
 * Get default consumption for a vehicle type
 */
export function getDefaultConsumption(vehicleType: string): number {
  return DEFAULT_CONSUMPTION[vehicleType] ?? DEFAULT_CONSUMPTION.default;
}
