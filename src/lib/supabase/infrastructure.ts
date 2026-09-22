import { supabase } from "@/integrations/supabase/client";

// Ratios for estimating equipment COUNT only - NOT costs
// Costs must come from user input or infrastructure_plans table
const EV_VEHICLES_PER_CHARGER = 2.5; // 1 charger for 2-3 BEV
const FCEV_VEHICLES_PER_STATION = 20; // 1 H2 station for ~20 FCEV

interface InfrastructureResult {
  infrastructurePlanId: string;
  capex: number;
  opex: number;
  h2Stations: number;
  evChargers: number;
  evCapex: number;
  h2Capex: number;
  requiresUserInput: boolean;
}

/**
 * Generate infrastructure DRAFT plan from a scenario
 * Only estimates equipment COUNT - costs are set to 0 requiring user input
 * User must complete cost details in the Infrastructure module
 */
export async function generateInfrastructureFromScenario(
  scenarioId: string,
  userId: string
): Promise<InfrastructureResult> {
  // 1. Fetch scenario with fleet_composition
  const { data: scenario, error: scenarioError } = await supabase
    .from('scenarios')
    .select('*, projects(name)')
    .eq('id', scenarioId)
    .single();

  if (scenarioError || !scenario) {
    throw new Error('Scenario not found');
  }

  const fleetComposition = scenario.fleet_composition as {
    ev?: { count: number; annualKm: number };
    hydrogen?: { count: number; annualKm: number };
    diesel?: { count: number; annualKm: number };
  };

  // 2. Calculate vehicle counts
  const evCount = fleetComposition.ev?.count || 0;
  const h2Count = fleetComposition.hydrogen?.count || 0;

  // 3. Estimate infrastructure COUNT only (no cost assumptions)
  const h2StationsNeeded = h2Count > 0 ? Math.ceil(h2Count / FCEV_VEHICLES_PER_STATION) : 0;
  const evChargersNeeded = evCount > 0 ? Math.ceil(evCount / EV_VEHICLES_PER_CHARGER) : 0;

  // 4. Costs = 0 - user must complete in Infrastructure module
  // This prevents phantom data from appearing in TCO calculations
  const h2Capex = 0;
  const h2AnnualOpex = 0;
  const evCapex = 0;
  const evAnnualOpex = 0;

  // 5. Insert DRAFT plan - marked as requiring user input
  const { data: plan, error: insertError } = await supabase
    .from('infrastructure_plans')
    .insert({
      user_id: userId,
      scenario_id: scenarioId,
      project_id: scenario.project_id,
      name: `À compléter - ${scenario.name}`,
      h2_vehicles_count: h2Count,
      h2_stations_count: h2StationsNeeded,
      h2_capex: h2Capex,
      h2_opex: h2AnnualOpex,
      h2_daily_kg: h2Count * 30, // Estimate for user guidance
      h2_station_capacity: 200,
      h2_operating_hours: 12,
      h2_refueling_frequency: 1,
      h2_land_permits: 0, // User must enter
      ev_vehicles_count: evCount,
      chargers_fast: evChargersNeeded,
      chargers_slow: 0,
      chargers_ultra: 0,
      ev_capex: evCapex,
      ev_opex: evAnnualOpex,
      ev_daily_kwh: evCount * 80, // Estimate for user guidance
      ev_battery_capacity_kwh: 100,
      ev_charging_hours: 8,
      ev_charging_speed: 'fast',
      ev_installation: 0, // User must enter
      ev_grid_upgrade: 0, // User must enter
      total_capex: 0,
      total_opex_10y: 0,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create infrastructure plan: ${insertError.message}`);
  }

  return {
    infrastructurePlanId: plan.id,
    capex: 0,
    opex: 0,
    h2Stations: h2StationsNeeded,
    evChargers: evChargersNeeded,
    evCapex: 0,
    h2Capex: 0,
    requiresUserInput: true,
  };
}

/**
 * Get existing infrastructure plan for a scenario
 */
export async function getInfrastructurePlanForScenario(
  scenarioId: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('infrastructure_plans')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

/**
 * Fetch all infrastructure plans for a user
 */
export async function getUserInfrastructurePlans(userId: string) {
  const { data, error } = await supabase
    .from('infrastructure_plans')
    .select('*, scenarios(name, project_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Calculate total infrastructure investment across all plans
 */
export async function getTotalInfrastructureInvestment(userId: string) {
  const plans = await getUserInfrastructurePlans(userId);
  
  return plans.reduce((totals, plan) => ({
    totalCapex: totals.totalCapex + (plan.total_capex || 0),
    totalOpex10y: totals.totalOpex10y + (plan.total_opex_10y || 0),
    totalH2Stations: totals.totalH2Stations + (plan.h2_stations_count || 0),
    totalEvChargers: totals.totalEvChargers + 
      (plan.chargers_slow || 0) + 
      (plan.chargers_fast || 0) + 
      (plan.chargers_ultra || 0),
    evCapex: totals.evCapex + (plan.ev_capex || 0),
    h2Capex: totals.h2Capex + (plan.h2_capex || 0),
    evAnnualOpex: totals.evAnnualOpex + (plan.ev_opex || 0),
    h2AnnualOpex: totals.h2AnnualOpex + (plan.h2_opex || 0),
  }), {
    totalCapex: 0,
    totalOpex10y: 0,
    totalH2Stations: 0,
    totalEvChargers: 0,
    evCapex: 0,
    h2Capex: 0,
    evAnnualOpex: 0,
    h2AnnualOpex: 0,
  });
}
