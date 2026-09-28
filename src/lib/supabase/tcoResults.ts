import { supabase } from '@/integrations/supabase/client';
import { TCOResult, YearlyBreakdown, VehicleTypeCosts } from '@/lib/calculations/types';
import { Json } from '@/integrations/supabase/types';

// Utility to ensure numeric values are never NaN or undefined
function safeNumber(value: number | undefined | null, defaultValue: number = 0): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return defaultValue;
  }
  return value;
}

// Convert database row to TCOResult type
function rowToTCOResult(row: {
  id: string;
  scenario_id: string;
  capex: number;
  opex_total: number;
  tco_total: number;
  tco_per_km: number | null;
  npv: number | null;
  residual_value: number | null;
  payback_period_years: number | null;
  co2_total: number;
  co2_savings: number | null;
  co2_savings_percent: number | null;
  charging_stations: number | null;
  charging_stations_cost: number | null;
  h2_stations: number | null;
  h2_stations_cost: number | null;
  total_infrastructure_cost: number | null;
  yearly_breakdown: Json | null;
  by_vehicle_type: Json | null;
  created_at: string;
  // New advanced cost columns
  downtime_cost: number | null;
  insurance_cost: number | null;
  telematics_cost: number | null;
  grid_demand_cost: number | null;
  carbon_credits_value: number | null;
  cold_weather_impact: number | null;
  baseline_tco: number | null;
  tco_savings: number | null;
  applied_diesel_price: number | null;
  applied_electricity_price: number | null;
  applied_hydrogen_price: number | null;
}, scenarioName: string = ''): TCOResult {
  return {
    scenarioId: row.scenario_id,
    scenarioName,
    capex: row.capex,
    opexTotal: row.opex_total,
    tcoTotal: row.tco_total,
    tcoPerKm: row.tco_per_km ?? 0,
    npv: row.npv ?? 0,
    residualValue: row.residual_value ?? 0,
    paybackPeriodYears: row.payback_period_years,
    baselineTco: row.baseline_tco ?? undefined,
    tcoSavings: row.tco_savings ?? undefined,
    co2Total: row.co2_total,
    co2Savings: row.co2_savings ?? 0,
    co2SavingsPercent: row.co2_savings_percent ?? 0,
    chargingStations: row.charging_stations ?? 0,
    chargingStationsCost: row.charging_stations_cost ?? 0,
    h2Stations: row.h2_stations ?? 0,
    h2StationsCost: row.h2_stations_cost ?? 0,
    totalInfrastructureCost: row.total_infrastructure_cost ?? 0,
    yearlyBreakdown: (row.yearly_breakdown as unknown as YearlyBreakdown[]) ?? [],
    byVehicleType: (row.by_vehicle_type as unknown as TCOResult['byVehicleType']) ?? {
      diesel: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
      ev: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
      hydrogen: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
    },
    // Map advanced costs
    downtimeCost: row.downtime_cost ?? 0,
    insuranceCost: row.insurance_cost ?? 0,
    telematicsCost: row.telematics_cost ?? 0,
    gridDemandCost: row.grid_demand_cost ?? 0,
    carbonCreditsValue: row.carbon_credits_value ?? 0,
    coldWeatherImpact: row.cold_weather_impact ?? 0,
    // Map applied prices for What-If synchronization
    appliedPrices: (row.applied_diesel_price != null || row.applied_electricity_price != null || row.applied_hydrogen_price != null) 
      ? {
          diesel: row.applied_diesel_price ?? 0,
          electricity: row.applied_electricity_price ?? 0,
          hydrogen: row.applied_hydrogen_price ?? 0,
        }
      : undefined,
  };
}

/**
 * Save TCO calculation results
 */
export async function saveTCOResult(result: TCOResult): Promise<string> {
  const { data, error } = await supabase
    .from('tco_results')
    .insert({
      scenario_id: result.scenarioId,
      capex: safeNumber(result.capex),
      opex_total: safeNumber(result.opexTotal),
      tco_total: safeNumber(result.tcoTotal),
      tco_per_km: safeNumber(result.tcoPerKm),
      npv: safeNumber(result.npv),
      residual_value: safeNumber(result.residualValue),
      payback_period_years: result.paybackPeriodYears ?? null,
      co2_total: safeNumber(result.co2Total),
      co2_savings: safeNumber(result.co2Savings),
      co2_savings_percent: safeNumber(result.co2SavingsPercent),
      charging_stations: safeNumber(result.chargingStations),
      charging_stations_cost: safeNumber(result.chargingStationsCost),
      h2_stations: safeNumber(result.h2Stations),
      h2_stations_cost: safeNumber(result.h2StationsCost),
      total_infrastructure_cost: safeNumber(result.totalInfrastructureCost),
      yearly_breakdown: result.yearlyBreakdown as unknown as Json,
      by_vehicle_type: result.byVehicleType as unknown as Json,
      // Save baseline comparison
      baseline_tco: result.baselineTco != null ? safeNumber(result.baselineTco) : null,
      tco_savings: result.tcoSavings != null ? safeNumber(result.tcoSavings) : null,
      // Save advanced costs
      downtime_cost: safeNumber(result.downtimeCost),
      insurance_cost: safeNumber(result.insuranceCost),
      telematics_cost: safeNumber(result.telematicsCost),
      grid_demand_cost: safeNumber(result.gridDemandCost),
      carbon_credits_value: safeNumber(result.carbonCreditsValue),
      cold_weather_impact: safeNumber(result.coldWeatherImpact),
      // Save applied prices for What-If synchronization
      applied_diesel_price: result.appliedPrices?.diesel != null ? safeNumber(result.appliedPrices.diesel) : null,
      applied_electricity_price: result.appliedPrices?.electricity != null ? safeNumber(result.appliedPrices.electricity) : null,
      applied_hydrogen_price: result.appliedPrices?.hydrogen != null ? safeNumber(result.appliedPrices.hydrogen) : null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving TCO result:', error);
    throw new Error(error.message);
  }

  return data.id;
}

/**
 * Get the latest TCO result for a scenario
 */
export async function getLatestTCOResult(scenarioId: string): Promise<TCOResult | null> {
  const { data, error } = await supabase
    .from('tco_results')
    .select('*')
    .eq('scenario_id', scenarioId)
    .eq('is_current', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching TCO result:', error);
    throw new Error(error.message);
  }

  return data ? rowToTCOResult(data) : null;
}

/**
 * Get all TCO results for a scenario
 */
export async function getTCOResultHistory(scenarioId: string): Promise<TCOResult[]> {
  const { data, error } = await supabase
    .from('tco_results')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching TCO result history:', error);
    throw new Error(error.message);
  }

  return (data || []).map(row => rowToTCOResult(row));
}

/**
 * Delete all TCO results for a scenario
 */
export async function deleteTCOResults(scenarioId: string): Promise<void> {
  const { error } = await supabase
    .from('tco_results')
    .delete()
    .eq('scenario_id', scenarioId);

  if (error) {
    console.error('Error deleting TCO results:', error);
    throw new Error(error.message);
  }
}
