// ============= Seed Demo Data into Supabase =============

import { supabase } from "@/integrations/supabase/client";
import {
  DEMO_PROJECT,
  DEMO_SCENARIOS,
  DEMO_TCO_RESULTS,
  DEMO_INFRASTRUCTURE,
  DEMO_ROADMAP,
  DEMO_FLEET,
  DEMO_FLEET_COMPOSITIONS,
} from "./stmMontreal";

const DEMO_PROJECT_IDENTIFIER = "STM Montreal - Électrification Bus";

/**
 * Check if demo project already exists for the user
 */
export async function checkDemoProjectExists(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", DEMO_PROJECT_IDENTIFIER)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Delete existing demo project and all related data
 */
export async function deleteDemoProject(userId: string): Promise<void> {
  const existingId = await checkDemoProjectExists(userId);
  if (!existingId) return;

  // Delete in order of dependencies
  // 1. TCO Results (via scenarios)
  const { data: scenarios } = await supabase
    .from("scenarios")
    .select("id")
    .eq("project_id", existingId);

  if (scenarios) {
    for (const scenario of scenarios) {
      await supabase.from("tco_results").delete().eq("scenario_id", scenario.id);
    }
  }

  // 2. Roadmap data
  const { data: roadmaps } = await supabase
    .from("transition_roadmaps")
    .select("id")
    .eq("project_id", existingId);

  if (roadmaps) {
    for (const roadmap of roadmaps) {
      // Delete milestones via phases
      const { data: phases } = await supabase
        .from("roadmap_phases")
        .select("id")
        .eq("roadmap_id", roadmap.id);
      
      if (phases) {
        for (const phase of phases) {
          await supabase.from("roadmap_milestones").delete().eq("phase_id", phase.id);
        }
        await supabase.from("roadmap_phases").delete().eq("roadmap_id", roadmap.id);
      }
      await supabase.from("transition_roadmaps").delete().eq("id", roadmap.id);
    }
  }

  // 3. Infrastructure plans
  await supabase.from("infrastructure_plans").delete().eq("project_id", existingId);

  // 4. Scenarios
  await supabase.from("scenarios").delete().eq("project_id", existingId);

  // 5. Project itself
  await supabase.from("projects").delete().eq("id", existingId);
}

/**
 * Seed the complete STM Montreal demo project
 */
export async function seedDemoProject(userId: string): Promise<{ projectId: string; success: boolean }> {
  try {
    // Delete existing demo if present
    await deleteDemoProject(userId);

    // 1. Create the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name: DEMO_PROJECT.name,
        description: DEMO_PROJECT.description,
        country_or_region: DEMO_PROJECT.countryOrRegion,
        currency: DEMO_PROJECT.currency,
        default_analysis_horizon_years: DEMO_PROJECT.defaultAnalysisHorizonYears,
        default_discount_rate: DEMO_PROJECT.defaultDiscountRate,
      })
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to create project: ${projectError?.message}`);
    }

    const projectId = project.id;

    // 2. Create scenarios
    const scenarioIds: Record<string, string> = {};
    const scenarioKeys = ["baseline", "bev100", "mix"];

    for (let i = 0; i < DEMO_SCENARIOS.length; i++) {
      const scenario = DEMO_SCENARIOS[i];
      const fleetComp = Object.values(DEMO_FLEET_COMPOSITIONS)[i];
      
      const { data: scenarioData, error: scenarioError } = await supabase
        .from("scenarios")
        .insert({
          project_id: projectId,
          name: scenario.name,
          description: scenario.description,
          analysis_years: scenario.analysisHorizonYears,
          discount_rate: scenario.discountRate,
          region: scenario.countryOrRegion,
          fleet_composition: fleetComp,
        })
        .select()
        .single();

      if (scenarioError || !scenarioData) {
        throw new Error(`Failed to create scenario: ${scenarioError?.message}`);
      }

      scenarioIds[scenarioKeys[i]] = scenarioData.id;
    }

    // 3. Create TCO results for each scenario
    for (const [key, scenarioId] of Object.entries(scenarioIds)) {
      const tcoData = DEMO_TCO_RESULTS[key];
      
      await supabase.from("tco_results").insert({
        scenario_id: scenarioId,
        capex: tcoData.capex,
        opex_total: tcoData.opexTotal,
        tco_total: tcoData.tcoTotal,
        tco_per_km: tcoData.tcoPerKm,
        co2_total: tcoData.co2Total,
        co2_savings_percent: tcoData.co2SavingsPercent,
        npv: tcoData.npv,
        payback_period_years: tcoData.paybackYears,
        charging_stations: tcoData.chargingStations,
        h2_stations: tcoData.h2Stations,
        applied_diesel_price: tcoData.appliedDieselPrice,
        applied_electricity_price: tcoData.appliedElectricityPrice,
        applied_hydrogen_price: tcoData.appliedHydrogenPrice,
        yearly_breakdown: tcoData.yearlyBreakdown,
        baseline_tco: DEMO_TCO_RESULTS.baseline.tcoTotal,
        tco_savings: DEMO_TCO_RESULTS.baseline.tcoTotal - tcoData.tcoTotal,
        co2_savings: DEMO_TCO_RESULTS.baseline.co2Total - tcoData.co2Total,
      });
    }

    // 4. Create infrastructure plan (for BEV scenario)
    await supabase.from("infrastructure_plans").insert({
      user_id: userId,
      project_id: projectId,
      scenario_id: scenarioIds.bev100,
      name: DEMO_INFRASTRUCTURE.name,
      ev_vehicles_count: DEMO_INFRASTRUCTURE.evVehiclesCount,
      ev_daily_kwh: DEMO_INFRASTRUCTURE.evDailyKwh,
      ev_battery_capacity_kwh: DEMO_INFRASTRUCTURE.evBatteryCapacityKwh,
      ev_charging_speed: DEMO_INFRASTRUCTURE.evChargingSpeed,
      ev_charging_hours: DEMO_INFRASTRUCTURE.evChargingHours,
      chargers_slow: DEMO_INFRASTRUCTURE.chargersSlow,
      chargers_fast: DEMO_INFRASTRUCTURE.chargersFast,
      chargers_ultra: DEMO_INFRASTRUCTURE.chargersUltra,
      ev_capex: DEMO_INFRASTRUCTURE.evCapex,
      ev_installation: DEMO_INFRASTRUCTURE.evInstallation,
      ev_grid_upgrade: DEMO_INFRASTRUCTURE.evGridUpgrade,
      ev_opex: DEMO_INFRASTRUCTURE.evOpex,
      h2_vehicles_count: DEMO_INFRASTRUCTURE.h2VehiclesCount,
      h2_daily_kg: DEMO_INFRASTRUCTURE.h2DailyKg,
      h2_station_capacity: DEMO_INFRASTRUCTURE.h2StationCapacity,
      h2_operating_hours: DEMO_INFRASTRUCTURE.h2OperatingHours,
      h2_refueling_frequency: DEMO_INFRASTRUCTURE.h2RefuelingFrequency,
      h2_stations_count: DEMO_INFRASTRUCTURE.h2StationsCount,
      h2_capex: DEMO_INFRASTRUCTURE.h2Capex,
      h2_land_permits: DEMO_INFRASTRUCTURE.h2LandPermits,
      h2_opex: DEMO_INFRASTRUCTURE.h2Opex,
      total_capex: DEMO_INFRASTRUCTURE.totalCapex,
      total_opex_10y: DEMO_INFRASTRUCTURE.totalOpex10y,
    });

    // 5. Create transition roadmap
    const { data: roadmap, error: roadmapError } = await supabase
      .from("transition_roadmaps")
      .insert({
        project_id: projectId,
        created_by: userId,
        name: "Roadmap Électrification STM 2024-2027",
        description: "Plan de déploiement sur 3 ans pour l'électrification de 40 bus urbains",
        start_date: DEMO_ROADMAP[0].startDate,
        end_date: DEMO_ROADMAP[DEMO_ROADMAP.length - 1].endDate,
        status: "in_progress",
        currency: "CAD",
        total_budget: DEMO_ROADMAP.reduce((sum, p) => sum + p.budgetAllocated, 0),
      })
      .select()
      .single();

    if (roadmapError || !roadmap) {
      throw new Error(`Failed to create roadmap: ${roadmapError?.message}`);
    }

    // 6. Create phases and milestones
    for (let i = 0; i < DEMO_ROADMAP.length; i++) {
      const phase = DEMO_ROADMAP[i];
      
      const { data: phaseData, error: phaseError } = await supabase
        .from("roadmap_phases")
        .insert({
          roadmap_id: roadmap.id,
          name: phase.name,
          description: phase.description,
          start_date: phase.startDate,
          end_date: phase.endDate,
          color: phase.color,
          order_index: i,
          budget_allocated: phase.budgetAllocated,
          status: i === 0 ? "completed" : i === 1 ? "in_progress" : "planned",
          completion_percentage: i === 0 ? 100 : i === 1 ? 60 : 0,
        })
        .select()
        .single();

      if (phaseError || !phaseData) {
        throw new Error(`Failed to create phase: ${phaseError?.message}`);
      }

      // Create milestones for this phase
      for (const milestone of phase.milestones) {
        await supabase.from("roadmap_milestones").insert({
          phase_id: phaseData.id,
          title: milestone.title,
          type: milestone.type,
          due_date: milestone.dueDate,
          description: milestone.description,
          is_critical: milestone.isCritical,
          cost_estimate: milestone.costEstimate,
          status: new Date(milestone.dueDate) < new Date() ? "completed" : "planned",
          progress_percentage: new Date(milestone.dueDate) < new Date() ? 100 : 0,
        });
      }
    }

    // 7. Create telematics connection and vehicles (optional - for demo purposes)
    const { data: connection } = await supabase
      .from("telematics_connections")
      .insert({
        user_id: userId,
        provider: "demo",
        username: "stm-demo",
        encrypted_credentials: "demo-credentials",
        status: "connected",
        last_sync_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (connection) {
      // Create vehicle group
      const { data: group } = await supabase
        .from("telematics_groups")
        .insert({
          user_id: userId,
          name: "Flotte STM Centre-Ville",
          vehicle_count: DEMO_FLEET.length,
          avg_daily_km: 195,
          recommended_technology: "BEV",
        })
        .select()
        .single();

      // Create vehicles
      if (group) {
        const vehicleInserts = DEMO_FLEET.map((v) => ({
          user_id: userId,
          connection_id: connection.id,
          group_id: group.id,
          external_id: v.externalId,
          vehicle_type: v.vehicleType,
          make_model: v.makeModel,
          annual_km: v.annualKm,
          fuel_consumption: v.fuelConsumption,
          route_type: v.routeType,
        }));

        await supabase.from("telematics_vehicles").insert(vehicleInserts);
      }
    }

    return { projectId, success: true };
  } catch (error) {
    console.error("Error seeding demo project:", error);
    throw error;
  }
}

/**
 * Get demo project info for display
 */
export function getDemoProjectInfo() {
  return {
    name: DEMO_PROJECT.name,
    description: DEMO_PROJECT.description,
    vehicleCount: DEMO_FLEET.length,
    scenarioCount: DEMO_SCENARIOS.length,
    region: "Québec, Canada",
    source: "STM 2025",
  };
}
