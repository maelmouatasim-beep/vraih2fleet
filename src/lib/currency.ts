import { Region } from './legacy/scenario-types';

export type Currency = 'CAD';

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  name: string;
  dieselUnit: string;
}

export const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  CAD: { code: 'CAD', symbol: 'CAD $', name: 'Canadian Dollar', dieselUnit: '/L' },
};

/**
 * Get currency based on region (always CAD for Canada-only)
 */
export function getCurrencyFromRegion(region: Region): Currency {
  return 'CAD';
}

/**
 * Get currency config based on region
 */
export function getCurrencyConfig(region: Region): CurrencyConfig {
  return CURRENCY_CONFIG.CAD;
}

/**
 * Format currency value with appropriate symbol
 */
export function formatCurrency(value: number, region: Region, options?: {
  compact?: boolean;
  decimals?: number;
}): string {
  const config = getCurrencyConfig(region);
  const { compact = true, decimals } = options || {};
  
  if (compact) {
    if (Math.abs(value) >= 1000000) {
      return `${config.symbol}${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${config.symbol}${(value / 1000).toFixed(0)}k`;
    }
  }
  
  const decimalPlaces = decimals !== undefined ? decimals : (Math.abs(value) < 10 ? 2 : 0);
  return `${config.symbol}${value.toFixed(decimalPlaces)}`;
}

/**
 * Format currency per unit (e.g., $/km, $/kWh)
 */
export function formatCurrencyPerUnit(value: number, region: Region, unit: string, decimals: number = 3): string {
  const config = getCurrencyConfig(region);
  return `${config.symbol}${value.toFixed(decimals)}${unit}`;
}

/**
 * Format energy price with appropriate unit
 */
export function formatEnergyPrice(price: number, region: Region, type: 'electricity' | 'diesel' | 'hydrogen'): string {
  const config = getCurrencyConfig(region);
  
  switch (type) {
    case 'electricity':
      return `${config.symbol}${price.toFixed(2)}/kWh`;
    case 'diesel':
      return `${config.symbol}${price.toFixed(2)}${config.dieselUnit}`;
    case 'hydrogen':
      return `${config.symbol}${price.toFixed(2)}/kg`;
    default:
      return `${config.symbol}${price.toFixed(2)}`;
  }
}

/**
 * Get currency symbol only
 */
export function getCurrencySymbol(region: Region): string {
  return getCurrencyConfig(region).symbol;
}

/**
 * Get currency label (e.g., "CAD")
 */
export function getCurrencyLabel(region: Region): string {
  return getCurrencyFromRegion(region);
}
