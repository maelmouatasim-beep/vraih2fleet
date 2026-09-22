import { supabase } from '@/integrations/supabase/client';
import { ReferenceData, Region } from '@/lib/calculations/types';

// Map regions to database region values (Canada only)
const REGION_DB_MAP: Record<Region, string[]> = {
  'Canada': ['Canada', 'Global'],
  'CA_ON': ['CA_ON', 'Canada', 'Global'],
  'CA_BC': ['CA_BC', 'Canada', 'Global'],
  'CA_QC': ['CA_QC', 'Canada', 'Global'],
  'CA_AB': ['CA_AB', 'Canada', 'Global'],
  'CA_MB': ['CA_MB', 'Canada', 'Global'],
};

interface ReferenceDataRow {
  category: string;
  subcategory: string;
  region: string;
  min_value: number;
  mid_value: number;
  max_value: number;
  unit: string;
}

/**
 * Fetch reference data from database for a specific region
 */
export async function fetchReferenceData(region: Region): Promise<ReferenceData> {
  const regions = REGION_DB_MAP[region] || ['Canada', 'Global'];
  
  const { data, error } = await supabase
    .from('reference_data_ranges')
    .select('category, subcategory, region, min_value, mid_value, max_value, unit')
    .in('region', regions);

  if (error) {
    console.error('Error fetching reference data:', error);
    throw new Error(error.message);
  }

  // Build reference data object from database values
  const refData = buildReferenceData(data as ReferenceDataRow[], region);
  return refData;
}

/**
 * Build ReferenceData object from database rows
 * Uses mid_value as the primary value
 */
function buildReferenceData(rows: ReferenceDataRow[], region: Region): ReferenceData {
  // Default values (Canada-focused, updated Jan 2025)
  const result: ReferenceData = {
    diesel_truck: 150000,
    ev_truck: 280000,
    hydrogen_truck: 350000,
    diesel_price: 1.48,        // CAD$/L - Canada national average 2025
    electricity_price: 0.12,
    hydrogen_price: 12.00,     // CAD$/kg - Canada production cost 2025
    co2_factor_diesel: 2.68,   // kg CO2/L
    co2_factor_grid: 120,      // kg CO2/MWh (Canada average)
    maintenance_diesel: 15000,
    maintenance_ev: 8000,
    maintenance_hydrogen: 10000,
  };

  // Helper to find best match (prefer specific region, then country, then global)
  const findValue = (category: string, subcategory: string): number | null => {
    const matches = rows.filter(r => 
      r.category === category && 
      r.subcategory.toLowerCase().includes(subcategory.toLowerCase())
    );
    
    if (matches.length === 0) return null;
    
    // Sort by region specificity
    const regionOrder = REGION_DB_MAP[region] || [];
    matches.sort((a, b) => {
      const aIndex = regionOrder.indexOf(a.region);
      const bIndex = regionOrder.indexOf(b.region);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    return matches[0].mid_value;
  };

  // Map database values to ReferenceData fields
  const dieselPrice = findValue('fuel_prices', 'diesel');
  if (dieselPrice !== null) result.diesel_price = dieselPrice;

  const electricityPrice = findValue('electricity_prices', 'electricity') || 
                          findValue('electricity_prices', 'grid');
  if (electricityPrice !== null) result.electricity_price = electricityPrice;

  const hydrogenPrice = findValue('hydrogen_prices', 'hydrogen') ||
                       findValue('hydrogen_prices', 'grey') ||
                       findValue('hydrogen_prices', 'green');
  if (hydrogenPrice !== null) result.hydrogen_price = hydrogenPrice;

  const dieselTruck = findValue('vehicle_costs', 'diesel');
  if (dieselTruck !== null) result.diesel_truck = dieselTruck;

  const evTruck = findValue('vehicle_costs', 'electric') ||
                 findValue('vehicle_costs', 'ev') ||
                 findValue('vehicle_costs', 'bev');
  if (evTruck !== null) result.ev_truck = evTruck;

  const h2Truck = findValue('vehicle_costs', 'hydrogen') ||
                 findValue('vehicle_costs', 'fuel cell') ||
                 findValue('vehicle_costs', 'fcev');
  if (h2Truck !== null) result.hydrogen_truck = h2Truck;

  const co2Diesel = findValue('co2_factors', 'diesel');
  if (co2Diesel !== null) result.co2_factor_diesel = co2Diesel;

  const co2Grid = findValue('co2_factors', 'electricity') ||
                 findValue('co2_factors', 'grid');
  if (co2Grid !== null) result.co2_factor_grid = co2Grid;

  return result;
}

/**
 * Get available regions from database
 */
export async function getAvailableRegions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('reference_data_ranges')
    .select('region')
    .order('region');

  if (error) {
    console.error('Error fetching regions:', error);
    return [];
  }

  const uniqueRegions = [...new Set((data || []).map(r => r.region))];
  // Filter to only Canadian regions
  const canadianRegions = uniqueRegions.filter(r => 
    r === 'Canada' || r === 'Global' || r.startsWith('CA_')
  );
  return canadianRegions;
}
