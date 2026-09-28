import { supabase } from '@/integrations/supabase/client';
import { Scenario, FleetComposition, Region, CreateScenarioForm, VehicleConfiguration } from '@/lib/legacy/scenario-types';
import { Json } from '@/integrations/supabase/types';

// Convert database row to Scenario type
function rowToScenario(row: {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  region: string;
  analysis_years: number;
  discount_rate: number;
  fleet_composition: Json;
  created_at: string;
  updated_at: string;
}): Scenario {
  // Extract fleet composition with potential nested vehicleConfiguration
  const fleetComp = row.fleet_composition as unknown as FleetComposition & {
    vehicleConfiguration?: VehicleConfiguration;
  };
  
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    region: row.region as Region,
    analysisYears: row.analysis_years,
    discountRate: row.discount_rate,
    fleetComposition: fleetComp,
    // Extract vehicleConfiguration from fleet_composition if stored there
    vehicleConfiguration: fleetComp.vehicleConfiguration,
    createdAt: row.created_at,
  };
}

/**
 * Create a new scenario
 */
export async function createScenario(
  projectId: string,
  data: CreateScenarioForm
): Promise<Scenario> {
  const { data: result, error } = await supabase
    .from('scenarios')
    .insert({
      project_id: projectId,
      name: data.name,
      region: data.region,
      analysis_years: data.analysisYears,
      discount_rate: data.discountRate,
      fleet_composition: data.fleetComposition as unknown as Json,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating scenario:', error);
    throw new Error(error.message);
  }

  return rowToScenario(result);
}

/**
 * Update an existing scenario
 */
export async function updateScenario(
  id: string,
  changes: Partial<CreateScenarioForm>
): Promise<Scenario> {
  const updateData: Record<string, unknown> = {};
  
  if (changes.name !== undefined) updateData.name = changes.name;
  if (changes.region !== undefined) updateData.region = changes.region;
  if (changes.analysisYears !== undefined) updateData.analysis_years = changes.analysisYears;
  if (changes.discountRate !== undefined) updateData.discount_rate = changes.discountRate;
  if (changes.fleetComposition !== undefined) updateData.fleet_composition = changes.fleetComposition;

  const { data: result, error } = await supabase
    .from('scenarios')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating scenario:', error);
    throw new Error(error.message);
  }

  return rowToScenario(result);
}

/**
 * Delete a scenario
 */
export async function deleteScenario(id: string): Promise<void> {
  const { error } = await supabase
    .from('scenarios')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting scenario:', error);
    throw new Error(error.message);
  }
}

/**
 * Get a single scenario by ID
 */
export async function getScenario(id: string): Promise<Scenario | null> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching scenario:', error);
    throw new Error(error.message);
  }

  return data ? rowToScenario(data) : null;
}

/**
 * List all scenarios for a project
 */
export async function listScenarios(projectId: string): Promise<Scenario[]> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing scenarios:', error);
    throw new Error(error.message);
  }

  return (data || []).map(rowToScenario);
}

/**
 * Duplicate a scenario
 */
export async function duplicateScenario(
  scenarioId: string,
  newName: string
): Promise<Scenario> {
  const scenario = await getScenario(scenarioId);
  
  if (!scenario) {
    throw new Error('Scenario not found');
  }

  return createScenario(scenario.projectId, {
    name: newName,
    region: scenario.region,
    analysisYears: scenario.analysisYears,
    discountRate: scenario.discountRate,
    fleetComposition: scenario.fleetComposition,
  });
}
