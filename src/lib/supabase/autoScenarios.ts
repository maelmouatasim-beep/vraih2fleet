import { supabase } from '@/integrations/supabase/client';
import { createProject } from './projects';
import { createScenario } from './scenarios';
import { VehicleGroup, ScenarioRecommendation } from '@/lib/mockTelematicsData';
import { FleetComposition } from '@/lib/calculations/types';

export interface AutoScenarioResult {
  projectId: string;
  projectName: string;
  scenarios: {
    id: string;
    name: string;
    type: 'bev' | 'fcev' | 'mixed';
  }[];
}

/**
 * Create a project with 3 auto-generated scenarios from telematics data
 */
export async function createScenariosFromTelematics(
  userId: string,
  groups: VehicleGroup[],
  recommendations: ScenarioRecommendation[],
  projectName?: string
): Promise<AutoScenarioResult> {
  // Calculate totals from groups
  const totalVehicles = groups.reduce((sum, g) => sum + g.vehicles.length, 0);
  const totalAnnualKm = groups.reduce(
    (sum, g) => sum + g.vehicles.reduce((vSum, v) => vSum + v.annualKm, 0),
    0
  );
  const avgAnnualKm = totalVehicles > 0 ? Math.round(totalAnnualKm / totalVehicles) : 50000;

  // Get vehicle counts by group type
  const shortRangeGroup = groups.find(g => g.id === 'short-range');
  const mediumRangeGroup = groups.find(g => g.id === 'medium-range');
  const longRangeGroup = groups.find(g => g.id === 'long-range');

  const shortRangeCount = shortRangeGroup?.vehicles.length || 0;
  const mediumRangeCount = mediumRangeGroup?.vehicles.length || 0;
  const longRangeCount = longRangeGroup?.vehicles.length || 0;

  // Create project
  const project = await createProject(userId, {
    name: projectName || `Fleet Transition - ${new Date().toLocaleDateString()}`,
    description: `Auto-generated from telematics import with ${totalVehicles} vehicles`,
    countryOrRegion: 'CA_QC',
    currency: 'CAD',
    defaultAnalysisHorizonYears: 10,
    defaultDiscountRate: 5,
  });

  const scenarios: AutoScenarioResult['scenarios'] = [];

  // Scenario 1: 100% BEV - ALL vehicles are electric (0 diesel, 0 hydrogen)
  const bevFleet: FleetComposition = {
    diesel: { count: 0, annualKm: 0 },
    ev: { count: totalVehicles, annualKm: avgAnnualKm },
    hydrogen: { count: 0, annualKm: 0 },
  };

  const bevScenario = await createScenario(project.id, {
    name: '100% BEV',
    region: 'CA_QC',
    analysisYears: 10,
    discountRate: 5,
    fleetComposition: bevFleet,
  });
  scenarios.push({ id: bevScenario.id, name: bevScenario.name, type: 'bev' });

  // Scenario 2: 100% FCEV - ALL vehicles are hydrogen (0 diesel, 0 electric)
  const fcevFleet: FleetComposition = {
    diesel: { count: 0, annualKm: 0 },
    ev: { count: 0, annualKm: 0 },
    hydrogen: { count: totalVehicles, annualKm: avgAnnualKm },
  };

  const fcevScenario = await createScenario(project.id, {
    name: '100% FCEV',
    region: 'CA_QC',
    analysisYears: 10,
    discountRate: 5,
    fleetComposition: fcevFleet,
  });
  scenarios.push({ id: fcevScenario.id, name: fcevScenario.name, type: 'fcev' });

  // Scenario 3: Mixed BEV/FCEV (optimal based on range analysis)
  // Short-range → BEV, Long-range → FCEV, Medium-range → split
  const mixedFleet: FleetComposition = {
    diesel: { count: 0, annualKm: 0 },
    ev: { count: shortRangeCount + Math.floor(mediumRangeCount / 2), annualKm: avgAnnualKm },
    hydrogen: { count: longRangeCount + Math.ceil(mediumRangeCount / 2), annualKm: avgAnnualKm },
  };

  const mixedScenario = await createScenario(project.id, {
    name: 'Mixed BEV/FCEV (Optimized)',
    region: 'CA_QC',
    analysisYears: 10,
    discountRate: 5,
    fleetComposition: mixedFleet,
  });
  scenarios.push({ id: mixedScenario.id, name: mixedScenario.name, type: 'mixed' });

  return {
    projectId: project.id,
    projectName: project.name,
    scenarios,
  };
}
