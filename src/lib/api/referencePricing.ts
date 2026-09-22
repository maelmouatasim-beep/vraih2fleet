import { supabase } from '@/integrations/supabase/client';

export interface RegionalPricing {
  id: string;
  region: string;
  fuel_type: string;
  price_per_unit: number;
  currency: string;
  source: string | null;
  source_url: string | null;
  valid_from: string;
  valid_to: string | null;
}

// Default pricing fallbacks (CAD)
const DEFAULT_PRICING: Record<string, Omit<RegionalPricing, 'id' | 'valid_from' | 'valid_to'>> = {
  diesel: { 
    region: 'CA', 
    fuel_type: 'diesel', 
    price_per_unit: 1.68, 
    currency: 'CAD', 
    source: 'Default fallback',
    source_url: null
  },
  electricity: { 
    region: 'CA', 
    fuel_type: 'electricity', 
    price_per_unit: 0.11, 
    currency: 'CAD', 
    source: 'Default fallback',
    source_url: null
  },
  hydrogen: { 
    region: 'CA', 
    fuel_type: 'hydrogen', 
    price_per_unit: 12.00, 
    currency: 'CAD', 
    source: 'Default fallback',
    source_url: null
  },
};

/**
 * Fetch regional pricing for a specific fuel type
 * Falls back to Canada default, then hardcoded defaults
 */
export async function getRegionalPricing(
  region: string, 
  fuelType: string
): Promise<RegionalPricing | null> {
  const today = new Date().toISOString().split('T')[0];
  
  // Try exact region match first
  const { data, error } = await supabase
    .from('reference_pricing')
    .select('*')
    .eq('region', region)
    .eq('fuel_type', fuelType)
    .lte('valid_from', today)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!error && data) {
    return data as RegionalPricing;
  }
  
  // Fallback to Canada default if region not found
  if (region !== 'CA') {
    const { data: fallbackData } = await supabase
      .from('reference_pricing')
      .select('*')
      .eq('region', 'CA')
      .eq('fuel_type', fuelType)
      .lte('valid_from', today)
      .or(`valid_to.is.null,valid_to.gte.${today}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (fallbackData) {
      return fallbackData as RegionalPricing;
    }
  }
  
  // Final fallback to hardcoded defaults
  // Fallback to defaults silently in production
  const defaultData = DEFAULT_PRICING[fuelType];
  if (defaultData) {
    return {
      ...defaultData,
      id: 'default',
      valid_from: today,
      valid_to: null,
    } as RegionalPricing;
  }
  
  return null;
}

/**
 * Fetch all pricing for a region
 */
export async function getAllRegionalPricing(region: string): Promise<{
  diesel: RegionalPricing | null;
  electricity: RegionalPricing | null;
  hydrogen: RegionalPricing | null;
}> {
  const [diesel, electricity, hydrogen] = await Promise.all([
    getRegionalPricing(region, 'diesel'),
    getRegionalPricing(region, 'electricity'),
    getRegionalPricing(region, 'hydrogen'),
  ]);
  
  return { diesel, electricity, hydrogen };
}

/**
 * Get list of available regions
 */
export async function getAvailableRegions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('reference_pricing')
    .select('region')
    .order('region');
  
  if (error || !data) {
    return ['CA', 'QC', 'ON', 'BC', 'AB'];
  }
  
  // Unique regions
  return [...new Set(data.map(d => d.region))];
}

/**
 * Map common region codes
 */
export function normalizeRegion(regionCode: string): string {
  const mapping: Record<string, string> = {
    'CA_QC': 'QC',
    'CA_ON': 'ON',
    'CA_BC': 'BC',
    'CA_AB': 'AB',
    'US_CA': 'US-CA',
    'quebec': 'QC',
    'ontario': 'ON',
    'british_columbia': 'BC',
    'alberta': 'AB',
    'california': 'US-CA',
  };
  
  return mapping[regionCode] || regionCode;
}
