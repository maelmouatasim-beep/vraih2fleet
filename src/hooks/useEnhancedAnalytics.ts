import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AnalyticsFilters {
  projectId: string | null;    // null = tous les projets (portefeuille)
  scenarioId: string | null;   // null = tous les scénarios du projet
}

export interface KPIMetrics {
  totalProjects: number;
  activeScenarios: number;
  totalVehicles: number;
  co2Reduction: number;
  co2ReductionPercent: number;
  // TCO Total (primary metric) - sum of all calculated TCO
  totalTcoSum: number;
  avgTcoPerVehicle: number;
  // TCO Savings (secondary metric) - difference vs diesel baseline
  totalTcoSavings: number;
  avgPaybackYears: number;
  bevCount: number;
  fcevCount: number;
  dieselCount: number;
  projectsThisMonth: number;
  scenariosThisMonth: number;
  // Traceability fields
  sourceScenarioCount: number;
  sourceScenarioNames: string[];
  dataQuality: 'excellent' | 'good' | 'limited' | 'none';
  // Cost per km
  tcoPerKm: number;
  totalFleetKm: number;
  // Subsidy risk analysis
  subsidyRiskPercent: number;
  totalSubsidies: number;
  subsidyRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  // NEW: Financial breakdown for strategic dashboard
  totalCapex: number;
  totalOpex: number;
  totalNpv: number;
  baselineTco: number;
  // NEW: Aggregation context for transparency
  aggregationMode: 'scenario' | 'project' | 'portfolio';
  aggregationLabel: string;
}

export interface AnnualOpexBreakdown {
  year: number;
  fuelCost: number;
  maintenanceCost: number;
  insuranceCost: number;
  otherCost: number;
  total: number;
}

export interface CostProjection {
  year: number;
  dieselTco: number;
  bevTco: number;
  fcevTco: number;
  mixedTco: number;
  cumulativeSavings: number;
}

export interface TransitionScenario {
  id: string;
  name: string;
  type: 'rapid' | 'progressive' | 'conservative' | 'custom';
  bevPercent: number;
  fcevPercent: number;
  dieselPercent: number;
  yearlyMilestones: { year: number; bevPercent: number; fcevPercent: number }[];
  totalSavings: number;
  co2Reduction: number;
  tcoTotal?: number;
  capex?: number;
  paybackYears?: number;
  isRealScenario?: boolean;
}

// SensitivityData moved to useRiskAnalysis hook - kept here for backwards compatibility
export interface SensitivityData {
  parameter: string;
  baseValue: number;
  impact: number;
  scenarios: { variation: number; tcoChange: number }[];
}

export interface FleetComparison {
  category: string;
  current: number;
  target: number;
  difference: number;
  percentChange: number;
}

export interface EnhancedAnalyticsData {
  kpis: KPIMetrics;
  costProjections: CostProjection[];
  transitionScenarios: TransitionScenario[];
  sensitivityAnalysis: SensitivityData[]; // Deprecated - use RiskAnalysisPanel instead
  fleetComparison: FleetComparison[];
  roiData: { year: number; cumulative: number; breakeven: boolean }[];
  annualOpexBreakdown: AnnualOpexBreakdown[];
  // Scenario-specific prices and operational data for What-If synchronization
  scenarioPrices?: {
    diesel: number;
    electricity: number;
    hydrogen: number;
    // Operational data synced from scenarios
    avgAnnualKm: number;
    avgVehicleCost: number;
    avgSubsidyPerVehicle: number;
    // Metadata
    source: 'scenario' | 'portfolio';
    scenarioCount: number;
    activeFuelTypes: ('diesel' | 'electricity' | 'hydrogen')[];
  };
  isLoading: boolean;
  error: string | null;
  hasData: boolean;
}

const defaultKpis: KPIMetrics = {
  totalProjects: 0,
  activeScenarios: 0,
  totalVehicles: 0,
  co2Reduction: 0,
  co2ReductionPercent: 0,
  totalTcoSum: 0,
  avgTcoPerVehicle: 0,
  totalTcoSavings: 0,
  avgPaybackYears: 0,
  bevCount: 0,
  fcevCount: 0,
  dieselCount: 0,
  projectsThisMonth: 0,
  scenariosThisMonth: 0,
  sourceScenarioCount: 0,
  sourceScenarioNames: [],
  dataQuality: 'none',
  tcoPerKm: 0,
  totalFleetKm: 0,
  subsidyRiskPercent: 0,
  totalSubsidies: 0,
  subsidyRiskLevel: 'low',
  // Financial breakdown
  totalCapex: 0,
  totalOpex: 0,
  totalNpv: 0,
  baselineTco: 0,
  // Aggregation context
  aggregationMode: 'portfolio',
  aggregationLabel: '',
};

export function useEnhancedAnalytics(filters: AnalyticsFilters): EnhancedAnalyticsData {
  const { user } = useAuth();
  const [data, setData] = useState<EnhancedAnalyticsData>({
    kpis: defaultKpis,
    costProjections: [],
    transitionScenarios: [],
    sensitivityAnalysis: [],
    fleetComparison: [],
    roiData: [],
    annualOpexBreakdown: [],
    isLoading: true,
    error: null,
    hasData: false,
  });

  useEffect(() => {
    if (!user?.id) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const fetchData = async () => {
      try {
        const now = new Date();

        // Fetch projects
        let projectsQuery = supabase
          .from("projects")
          .select("*")
          .eq("user_id", user.id);

        const { data: projects, error: projectsError } = await projectsQuery;
        if (projectsError) throw projectsError;

        // Determine which project IDs to use based on filter
        let projectIds: string[];
        if (filters.projectId) {
          projectIds = [filters.projectId];
        } else {
          projectIds = projects?.map(p => p.id) || [];
        }
        
        // Early return if no projects
        if (projectIds.length === 0) {
          setData({
            kpis: { ...defaultKpis, dataQuality: 'none' },
            costProjections: [],
            transitionScenarios: [],
            sensitivityAnalysis: [],
            fleetComparison: [],
            roiData: [],
            annualOpexBreakdown: [],
            isLoading: false,
            error: null,
            hasData: false,
          });
          return;
        }

        // Fetch scenarios with cascading filter
        let scenariosQuery = supabase
          .from("scenarios")
          .select("*")
          .in("project_id", projectIds);

        // If scenarioId is specified, filter to that specific scenario
        if (filters.scenarioId) {
          scenariosQuery = scenariosQuery.eq("id", filters.scenarioId);
        }

        const { data: scenarios, error: scenariosError } = await scenariosQuery;
        if (scenariosError) throw scenariosError;

        // Fetch TCO results with the new tco_savings column
        const scenarioIds = scenarios?.map(s => s.id) || [];
        let tcoResults: any[] = [];
        
        if (scenarioIds.length > 0) {
          const { data: tcoData, error: tcoError } = await supabase
            .from("tco_results")
            .select("*, tco_savings, baseline_tco, applied_diesel_price, applied_electricity_price, applied_hydrogen_price")
            .in("scenario_id", scenarioIds);

          if (tcoError) throw tcoError;
          tcoResults = tcoData || [];
        }

        // Fetch telematics data if available
        const { data: telematicsVehicles } = await supabase
          .from("telematics_vehicles")
          .select("*")
          .eq("user_id", user.id);

        // Calculate KPIs
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let totalVehicles = 0;
        let bevCount = 0;
        let fcevCount = 0;
        let dieselCount = 0;

        scenarios?.forEach(scenario => {
          const fleet = scenario.fleet_composition as any;
          if (fleet) {
            const ev = fleet.ev?.count || fleet.bev?.count || 0;
            const h2 = fleet.hydrogen?.count || fleet.fcev?.count || 0;
            const diesel = fleet.diesel?.count || 0;
            
            bevCount += ev;
            fcevCount += h2;
            dieselCount += diesel;
            totalVehicles += ev + h2 + diesel;
          }
        });

        // Add telematics vehicles if not already counted
        if (telematicsVehicles && telematicsVehicles.length > 0) {
          const telematicsCount = telematicsVehicles.length;
          if (totalVehicles === 0) {
            totalVehicles = telematicsCount;
            telematicsVehicles.forEach(v => {
              if (v.vehicle_type === 'Light Van') bevCount++;
              else if (v.vehicle_type === 'Heavy Truck') fcevCount++;
              else dieselCount++;
            });
          }
        }

        const totalCo2Savings = tcoResults.reduce((sum, r) => sum + (r.co2_savings || 0), 0);
        const totalCo2 = tcoResults.reduce((sum, r) => sum + (r.co2_total || 0), 0);
        const co2ReductionPercent = totalCo2 > 0 ? (totalCo2Savings / (totalCo2 + totalCo2Savings)) * 100 : 0;

        const paybackYears = tcoResults
          .filter(r => r.payback_period_years)
          .map(r => r.payback_period_years);
        const avgPaybackYears = paybackYears.length > 0
          ? paybackYears.reduce((a, b) => a + b, 0) / paybackYears.length
          : 0;

        // Calculate data quality
        const scenarioCountForQuality = scenarios?.length || 0;
        const tcoCount = tcoResults.length;
        let dataQuality: 'excellent' | 'good' | 'limited' | 'none' = 'none';
        if (tcoCount >= 5) dataQuality = 'excellent';
        else if (tcoCount >= 2) dataQuality = 'good';
        else if (tcoCount >= 1 || scenarioCountForQuality >= 1) dataQuality = 'limited';

        // Get scenario names for traceability
        const sourceScenarioNames = scenarios
          ?.filter(s => tcoResults.some(r => r.scenario_id === s.id))
          .map(s => s.name) || [];

        // Calculate total fleet km for Cost per km (raw sum for fleet distance)
        let totalFleetKm = 0;
        scenarios?.forEach(scenario => {
          const fleet = scenario.fleet_composition as any;
          const analysisYears = scenario.analysis_years || 10;
          if (fleet) {
            const dieselKm = (fleet.diesel?.count || 0) * (fleet.diesel?.annualKm || 50000) * analysisYears;
            const evKm = (fleet.ev?.count || fleet.bev?.count || 0) * (fleet.ev?.annualKm || fleet.bev?.annualKm || 50000) * analysisYears;
            const h2Km = (fleet.hydrogen?.count || fleet.fcev?.count || 0) * (fleet.hydrogen?.annualKm || fleet.fcev?.annualKm || 50000) * analysisYears;
            totalFleetKm += dieselKm + evKm + h2Km;
          }
        });

        // Calculate total subsidies for Subsidy Risk (subsidy risk percent calculated after TCO aggregation)
        let totalSubsidies = 0;
        scenarios?.forEach(scenario => {
          const fleet = scenario.fleet_composition as any;
          if (fleet) {
            const evCount = fleet.ev?.count || fleet.bev?.count || 0;
            const h2Count = fleet.hydrogen?.count || fleet.fcev?.count || 0;
            const evSubsidy = fleet.ev?.vehicleParams?.subsidyPerVehicle || fleet.bev?.vehicleParams?.subsidyPerVehicle || 0;
            const h2Subsidy = fleet.hydrogen?.vehicleParams?.subsidyPerVehicle || fleet.fcev?.vehicleParams?.subsidyPerVehicle || 0;
            totalSubsidies += (evCount * evSubsidy) + (h2Count * h2Subsidy);
          }
        });

        // Determine context mode based on filters
        const contextMode: 'scenario' | 'project' | 'portfolio' = 
          filters.scenarioId ? 'scenario' : 
          filters.projectId ? 'project' : 
          'portfolio';

        // Calculate financial breakdown with context-aware aggregation
        let totalCapex: number;
        let totalOpex: number;
        let totalTcoSum: number;
        let totalTcoSavings: number;
        let aggregationLabel: string;

        // Helper function to calculate savings for a TCO result
        const getSavings = (r: any): number => {
          if (r.tco_savings) return r.tco_savings;
          if (r.baseline_tco && r.tco_total) return r.baseline_tco - r.tco_total;
          return 0;
        };

        if (contextMode === 'scenario') {
          // Scenario mode: direct value from the selected scenario
          totalCapex = tcoResults[0]?.capex || 0;
          totalTcoSum = tcoResults[0]?.tco_total || 0;
          totalOpex = Math.max(0, totalTcoSum - totalCapex);
          totalTcoSavings = getSavings(tcoResults[0] || {});
          const scenarioName = scenarios?.find(s => s.id === filters.scenarioId)?.name || 'Scénario';
          aggregationLabel = scenarioName;
          
        } else if (contextMode === 'project') {
          // Project mode: average of all scenarios in the project
          const scenarioCount = tcoResults.length;
          if (scenarioCount > 0) {
            const rawTcoSum = tcoResults.reduce((sum, r) => sum + (r.tco_total || 0), 0);
            const rawSavings = tcoResults.reduce((sum, r) => sum + getSavings(r), 0);
            
            totalTcoSum = rawTcoSum / scenarioCount;
            totalTcoSavings = rawSavings / scenarioCount;
            totalCapex = tcoResults.reduce((sum, r) => sum + (r.capex || 0), 0) / scenarioCount;
            totalOpex = Math.max(0, totalTcoSum - totalCapex);
            aggregationLabel = scenarioCount > 1 
              ? `Moyenne de ${scenarioCount} scénarios`
              : scenarios?.[0]?.name || 'Scénario';
          } else {
            totalCapex = 0;
            totalOpex = 0;
            totalTcoSum = 0;
            totalTcoSavings = 0;
            aggregationLabel = 'Aucun résultat TCO';
          }
          
        } else {
          // Portfolio mode: average per project, then sum across projects
          const capexByProject = new Map<string, number[]>();
          const opexByProject = new Map<string, number[]>();
          const tcoByProject = new Map<string, number[]>();
          const savingsByProject = new Map<string, number[]>();
          
          // Group TCO results by project
          tcoResults.forEach(r => {
            const scenario = scenarios?.find(s => s.id === r.scenario_id);
            const projectId = scenario?.project_id || 'unknown';
            
            if (!capexByProject.has(projectId)) {
              capexByProject.set(projectId, []);
              opexByProject.set(projectId, []);
              tcoByProject.set(projectId, []);
              savingsByProject.set(projectId, []);
            }
            capexByProject.get(projectId)!.push(r.capex || 0);
            opexByProject.get(projectId)!.push(Math.max(0, (r.tco_total || 0) - (r.capex || 0)));
            tcoByProject.get(projectId)!.push(r.tco_total || 0);
            savingsByProject.get(projectId)!.push(getSavings(r));
          });
          
          // Calculate average per project, then sum
          let portfolioCapex = 0;
          let portfolioOpex = 0;
          let portfolioTco = 0;
          let portfolioSavings = 0;
          
          capexByProject.forEach((capexValues, projectId) => {
            portfolioCapex += capexValues.reduce((a, b) => a + b, 0) / capexValues.length;
            
            const opexValues = opexByProject.get(projectId) || [];
            portfolioOpex += opexValues.reduce((a, b) => a + b, 0) / opexValues.length;
            
            const tcoValues = tcoByProject.get(projectId) || [];
            portfolioTco += tcoValues.reduce((a, b) => a + b, 0) / tcoValues.length;
            
            const savingsValues = savingsByProject.get(projectId) || [];
            portfolioSavings += savingsValues.reduce((a, b) => a + b, 0) / savingsValues.length;
          });
          
          totalCapex = portfolioCapex;
          totalOpex = portfolioOpex;
          totalTcoSum = portfolioTco;
          totalTcoSavings = portfolioSavings;
          
          const projectCount = capexByProject.size;
          aggregationLabel = projectCount > 0 
            ? `${projectCount} projet${projectCount > 1 ? 's' : ''}`
            : 'Aucun résultat TCO';
        }

        // Calculate derived metrics using contextual TCO values
        const avgTcoPerVehicle = totalVehicles > 0 ? totalTcoSum / totalVehicles : 0;
        const tcoPerKm = totalFleetKm > 0 ? totalTcoSum / totalFleetKm : 0;

        // Calculate subsidy risk level (now using contextual totalTcoSum)
        const subsidyRiskPercent = totalTcoSum > 0 && totalSubsidies > 0
          ? Math.round((totalSubsidies / (totalTcoSum + totalSubsidies)) * 100)
          : 0;

        let subsidyRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (subsidyRiskPercent >= 30) subsidyRiskLevel = 'critical';
        else if (subsidyRiskPercent >= 20) subsidyRiskLevel = 'high';
        else if (subsidyRiskPercent >= 10) subsidyRiskLevel = 'medium';

        const totalNpv = tcoResults.reduce((sum, r) => sum + (r.npv || 0), 0);
        const baselineTco = tcoResults.reduce((sum, r) => sum + (r.baseline_tco || 0), 0);

        const kpis: KPIMetrics = {
          totalProjects: projects?.length || 0,
          activeScenarios: scenarios?.length || 0,
          totalVehicles,
          co2Reduction: Math.round(totalCo2Savings),
          co2ReductionPercent: Math.round(co2ReductionPercent),
          totalTcoSum: Math.round(totalTcoSum),
          avgTcoPerVehicle: Math.round(avgTcoPerVehicle),
          totalTcoSavings: Math.round(totalTcoSavings),
          avgPaybackYears: Math.round(avgPaybackYears * 10) / 10,
          bevCount,
          fcevCount,
          dieselCount,
          projectsThisMonth: projects?.filter(p => new Date(p.created_at) >= startOfMonth).length || 0,
          scenariosThisMonth: scenarios?.filter(s => new Date(s.created_at) >= startOfMonth).length || 0,
          sourceScenarioCount: tcoResults.length,
          sourceScenarioNames,
          dataQuality,
          tcoPerKm: Math.round(tcoPerKm * 1000) / 1000,
          totalFleetKm: Math.round(totalFleetKm),
          subsidyRiskPercent,
          totalSubsidies: Math.round(totalSubsidies),
          subsidyRiskLevel,
          // Financial breakdown with context-aware aggregation
          totalCapex: Math.round(totalCapex),
          totalOpex: Math.round(totalOpex),
          totalNpv: Math.round(totalNpv),
          baselineTco: Math.round(baselineTco),
          // Aggregation context for transparency
          aggregationMode: contextMode,
          aggregationLabel,
        };

        // Generate fleet comparison with actual composition only (no arbitrary targets)
        const fleetComparison: FleetComparison[] = totalVehicles > 0 ? [
          {
            category: 'BEV',
            current: bevCount,
            target: 0, // No arbitrary target - will be hidden in UI if 0
            difference: 0,
            percentChange: totalVehicles > 0 ? Math.round((bevCount / totalVehicles) * 100) : 0,
          },
          {
            category: 'FCEV',
            current: fcevCount,
            target: 0,
            difference: 0,
            percentChange: totalVehicles > 0 ? Math.round((fcevCount / totalVehicles) * 100) : 0,
          },
          {
            category: 'Diesel',
            current: dieselCount,
            target: 0,
            difference: 0,
            percentChange: totalVehicles > 0 ? Math.round((dieselCount / totalVehicles) * 100) : 0,
          },
        ] : [];

        // Build REAL transition scenarios from database scenarios
        const realTransitionScenarios: TransitionScenario[] = [];
        
        scenarios?.forEach((scenario) => {
          const fleet = scenario.fleet_composition as any;
          if (fleet) {
            const ev = fleet.ev?.count || fleet.bev?.count || 0;
            const h2 = fleet.hydrogen?.count || fleet.fcev?.count || 0;
            const diesel = fleet.diesel?.count || 0;
            const total = ev + h2 + diesel;
            
            if (total > 0) {
              const tcoResult = tcoResults.find(r => r.scenario_id === scenario.id);
              
              let type: 'rapid' | 'progressive' | 'conservative' | 'custom' = 'custom';
              if (diesel === 0 && h2 === 0) type = 'rapid';
              else if (diesel === 0 && ev === 0) type = 'progressive';
              else if (diesel === 0) type = 'conservative';
              
              realTransitionScenarios.push({
                id: scenario.id,
                name: scenario.name,
                type,
                bevPercent: Math.round((ev / total) * 100),
                fcevPercent: Math.round((h2 / total) * 100),
                dieselPercent: Math.round((diesel / total) * 100),
                yearlyMilestones: [],
                totalSavings: tcoResult?.tco_savings || 0,
                co2Reduction: tcoResult?.co2_savings || 0,
                tcoTotal: tcoResult?.tco_total || 0,
                capex: tcoResult?.capex || 0,
                paybackYears: tcoResult?.payback_period_years || null,
                isRealScenario: true,
              });
            }
          }
        });

        // Generate cost projections from REAL yearly breakdowns
        const costProjections = aggregateRealProjections(tcoResults, scenarios || []);

        // Generate ROI data from real TCO results with real analysis period
        const avgAnalysisYears = scenarios && scenarios.length > 0
          ? Math.round(scenarios.reduce((sum, s) => sum + (s.analysis_years || 10), 0) / scenarios.length)
          : 10;
        const roiData = generateRealRoiData(tcoResults, totalTcoSavings, avgAnalysisYears);

        // Sensitivity analysis now handled by RiskAnalysisPanel - keep empty for backwards compat
        const sensitivityAnalysis: SensitivityData[] = [];

        // Generate annual OPEX breakdown from tco_results
        const annualOpexBreakdown = generateAnnualOpexBreakdown(tcoResults, scenarios || []);

        // Extract scenario-specific prices and operational data for What-If analysis
        let scenarioPrices: EnhancedAnalyticsData['scenarioPrices'] = undefined;
        
        // Detect which fuel types are actively used based on fleet composition
        const activeFuelTypesSet = new Set<'diesel' | 'electricity' | 'hydrogen'>();
        
        // Also calculate weighted averages for operational data
        let totalVehiclesForKm = 0;
        let weightedKm = 0;
        let totalZeVehicles = 0;
        let weightedVehicleCost = 0;
        let weightedSubsidy = 0;
        
        scenarios?.forEach(scenario => {
          const fleet = scenario.fleet_composition as any;
          if (fleet) {
            // Check vehicle counts
            const evCount = fleet.ev?.count || fleet.bev?.count || 0;
            const h2Count = fleet.hydrogen?.count || fleet.fcev?.count || 0;
            const dieselScenarioCount = fleet.diesel?.count || 0;
            
            if (evCount > 0) activeFuelTypesSet.add('electricity');
            if (h2Count > 0) activeFuelTypesSet.add('hydrogen');
            if (dieselScenarioCount > 0) activeFuelTypesSet.add('diesel');
            
            // Also check target powertrains in vehicleConfiguration
            const config = fleet?.vehicleConfiguration;
            if (config?.targetPowertrains) {
              config.targetPowertrains.forEach((pt: string) => {
                if (pt === 'bev' || pt === 'phev') activeFuelTypesSet.add('electricity');
                if (pt === 'fcev') activeFuelTypesSet.add('hydrogen');
                if (pt === 'diesel' || pt === 'biodiesel' || pt === 'biomethane') activeFuelTypesSet.add('diesel');
              });
            }
            
            // Extract annualKm for weighted average
            const dieselKm = fleet.diesel?.annualKm || 50000;
            const evKm = fleet.ev?.annualKm || fleet.bev?.annualKm || 50000;
            const h2Km = fleet.hydrogen?.annualKm || fleet.fcev?.annualKm || 50000;
            
            totalVehiclesForKm += dieselScenarioCount + evCount + h2Count;
            weightedKm += (dieselScenarioCount * dieselKm) + (evCount * evKm) + (h2Count * h2Km);
            
            // Extract vehicle costs and subsidies for ZE vehicles only
            const evParams = fleet.ev?.vehicleParams || fleet.bev?.vehicleParams;
            const evCost = evParams?.vehicleCost || 380000;
            const evSubsidy = evParams?.subsidyPerVehicle || 100000;
            
            const h2Params = fleet.hydrogen?.vehicleParams || fleet.fcev?.vehicleParams;
            const h2Cost = h2Params?.vehicleCost || 550000;
            const h2Subsidy = h2Params?.subsidyPerVehicle || 150000;
            
            totalZeVehicles += evCount + h2Count;
            weightedVehicleCost += (evCount * evCost) + (h2Count * h2Cost);
            weightedSubsidy += (evCount * evSubsidy) + (h2Count * h2Subsidy);
          }
        });
        
        // Calculate final averages
        const avgAnnualKm = totalVehiclesForKm > 0 ? Math.round(weightedKm / totalVehiclesForKm) : 50000;
        const avgVehicleCost = totalZeVehicles > 0 ? Math.round(weightedVehicleCost / totalZeVehicles) : 380000;
        const avgSubsidyPerVehicle = totalZeVehicles > 0 ? Math.round(weightedSubsidy / totalZeVehicles) : 100000;
        
        // Also check tco_results for applied prices (backup detection)
        tcoResults.forEach(r => {
          if (r.applied_electricity_price != null && r.applied_electricity_price > 0) activeFuelTypesSet.add('electricity');
          if (r.applied_hydrogen_price != null && r.applied_hydrogen_price > 0) activeFuelTypesSet.add('hydrogen');
          if (r.applied_diesel_price != null && r.applied_diesel_price > 0) activeFuelTypesSet.add('diesel');
        });
        
        const activeFuelTypes = Array.from(activeFuelTypesSet) as ('diesel' | 'electricity' | 'hydrogen')[];
        
        if (filters.scenarioId && tcoResults.length > 0) {
          // Single scenario mode: use that scenario's applied prices
          const scenarioResult = tcoResults[0];
          if (scenarioResult.applied_diesel_price != null || 
              scenarioResult.applied_electricity_price != null || 
              scenarioResult.applied_hydrogen_price != null) {
            scenarioPrices = {
              diesel: scenarioResult.applied_diesel_price ?? 0,
              electricity: scenarioResult.applied_electricity_price ?? 0,
              hydrogen: scenarioResult.applied_hydrogen_price ?? 0,
              avgAnnualKm,
              avgVehicleCost,
              avgSubsidyPerVehicle,
              source: 'scenario',
              scenarioCount: 1,
              activeFuelTypes,
            };
          }
        } else if (tcoResults.length > 0) {
          // Multi-scenario / portfolio mode: calculate AVERAGE of applied prices
          const resultsWithPrices = tcoResults.filter(r => 
            r.applied_diesel_price != null || 
            r.applied_electricity_price != null || 
            r.applied_hydrogen_price != null
          );
          
          if (resultsWithPrices.length > 0) {
            // Calculate averages only for non-null values
            const dieselPrices = resultsWithPrices.filter(r => r.applied_diesel_price != null && r.applied_diesel_price > 0);
            const electricityPrices = resultsWithPrices.filter(r => r.applied_electricity_price != null && r.applied_electricity_price > 0);
            const hydrogenPrices = resultsWithPrices.filter(r => r.applied_hydrogen_price != null && r.applied_hydrogen_price > 0);
            
            const avgDiesel = dieselPrices.length > 0 
              ? dieselPrices.reduce((sum, r) => sum + (r.applied_diesel_price || 0), 0) / dieselPrices.length 
              : 0;
            const avgElectricity = electricityPrices.length > 0 
              ? electricityPrices.reduce((sum, r) => sum + (r.applied_electricity_price || 0), 0) / electricityPrices.length 
              : 0;
            const avgHydrogen = hydrogenPrices.length > 0 
              ? hydrogenPrices.reduce((sum, r) => sum + (r.applied_hydrogen_price || 0), 0) / hydrogenPrices.length 
              : 0;
            
            scenarioPrices = {
              diesel: avgDiesel,
              electricity: avgElectricity,
              hydrogen: avgHydrogen,
              avgAnnualKm,
              avgVehicleCost,
              avgSubsidyPerVehicle,
              source: 'portfolio',
              scenarioCount: resultsWithPrices.length,
              activeFuelTypes,
            };
          }
        }
        
        // Fallback: if no tco_results but we have fleet data, still provide operational data
        if (!scenarioPrices && (totalVehiclesForKm > 0 || totalZeVehicles > 0)) {
          scenarioPrices = {
            diesel: 0,
            electricity: 0,
            hydrogen: 0,
            avgAnnualKm,
            avgVehicleCost,
            avgSubsidyPerVehicle,
            source: 'portfolio',
            scenarioCount: scenarios?.length || 0,
            activeFuelTypes,
          };
        }

        setData({
          kpis,
          costProjections,
          transitionScenarios: realTransitionScenarios,
          sensitivityAnalysis,
          fleetComparison,
          roiData,
          annualOpexBreakdown,
          scenarioPrices,
          isLoading: false,
          error: null,
          hasData: (projects?.length || 0) > 0 || (telematicsVehicles?.length || 0) > 0,
        });

      } catch (err: any) {
        console.error("Enhanced analytics error:", err);
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    };

    fetchData();
  }, [user?.id, filters.projectId, filters.scenarioId]);

  return data;
}

// Aggregate real projections from yearly breakdowns with actual vehicle type costs
function aggregateRealProjections(tcoResults: any[], scenarios: any[]): CostProjection[] {
  if (tcoResults.length === 0) return [];

  // Calculate average analysis years from scenarios
  const avgAnalysisYears = scenarios.length > 0
    ? Math.round(scenarios.reduce((sum, s) => sum + (s.analysis_years || 10), 0) / scenarios.length)
    : 10;

  // Extract real costs by vehicle type from tco_results.by_vehicle_type
  const costsByType: Record<string, { count: number; totalCost: number }> = {
    diesel: { count: 0, totalCost: 0 },
    bev: { count: 0, totalCost: 0 },
    fcev: { count: 0, totalCost: 0 },
    mixed: { count: 0, totalCost: 0 },
  };

  tcoResults.forEach(result => {
    const byType = result.by_vehicle_type;
    if (byType && typeof byType === 'object') {
      Object.entries(byType).forEach(([key, data]: [string, any]) => {
        if (data && typeof data === 'object' && data.tcoTotal) {
          const typeKey = key.toLowerCase().includes('diesel') ? 'diesel' 
            : key.toLowerCase().includes('bev') || key.toLowerCase().includes('ev') ? 'bev'
            : key.toLowerCase().includes('fcev') || key.toLowerCase().includes('h2') || key.toLowerCase().includes('hydrogen') ? 'fcev'
            : 'mixed';
          costsByType[typeKey].count += 1;
          costsByType[typeKey].totalCost += data.tcoTotal || 0;
        }
      });
    }
    // Always count the mixed/total
    costsByType.mixed.count += 1;
    costsByType.mixed.totalCost += result.tco_total || 0;
  });

  // Calculate average annual costs
  const avgAnnualDiesel = costsByType.diesel.count > 0 
    ? (costsByType.diesel.totalCost / costsByType.diesel.count) / avgAnalysisYears 
    : 0;
  const avgAnnualBev = costsByType.bev.count > 0 
    ? (costsByType.bev.totalCost / costsByType.bev.count) / avgAnalysisYears 
    : 0;
  const avgAnnualFcev = costsByType.fcev.count > 0 
    ? (costsByType.fcev.totalCost / costsByType.fcev.count) / avgAnalysisYears 
    : 0;
  const avgAnnualMixed = costsByType.mixed.count > 0 
    ? (costsByType.mixed.totalCost / costsByType.mixed.count) / avgAnalysisYears 
    : 0;

  // If no breakdown by type, use the mixed average for projections
  const hasByTypeData = avgAnnualDiesel > 0 || avgAnnualBev > 0 || avgAnnualFcev > 0;
  
  let cumulativeSavings = 0;
  const projections: CostProjection[] = [];
  
  for (let year = 1; year <= avgAnalysisYears; year++) {
    // Apply 2% annual energy inflation for diesel, 1% for electricity/H2
    const dieselInflation = Math.pow(1.02, year - 1);
    const cleanInflation = Math.pow(1.01, year - 1);
    
    let dieselCost: number;
    let bevCost: number;
    let fcevCost: number;
    let mixedCost: number;
    
    if (hasByTypeData) {
      // Use real calculated data
      dieselCost = avgAnnualDiesel * dieselInflation;
      bevCost = avgAnnualBev * cleanInflation;
      fcevCost = avgAnnualFcev * cleanInflation;
      mixedCost = avgAnnualMixed * cleanInflation;
    } else {
      // Fallback: use mixed average with inflation only (no arbitrary ratios)
      mixedCost = avgAnnualMixed * cleanInflation;
      dieselCost = mixedCost; // Same as mixed if no data
      bevCost = mixedCost;
      fcevCost = mixedCost;
    }
    
    // Calculate savings vs diesel (only if we have diesel data)
    if (dieselCost > mixedCost) {
      cumulativeSavings += dieselCost - mixedCost;
    }
    
    projections.push({
      year,
      dieselTco: Math.round(dieselCost),
      bevTco: Math.round(bevCost),
      fcevTco: Math.round(fcevCost),
      mixedTco: Math.round(mixedCost),
      cumulativeSavings: Math.round(cumulativeSavings),
    });
  }
  
  return projections;
}

// Generate real ROI data from TCO results with actual analysis period
function generateRealRoiData(
  tcoResults: any[], 
  totalSavings: number, 
  analysisYears: number = 10
): { year: number; cumulative: number; breakeven: boolean; capex?: number }[] {
  if (tcoResults.length === 0) return [];

  const avgCapex = tcoResults.reduce((sum, r) => sum + (r.capex || 0), 0) / tcoResults.length;
  const annualSavings = totalSavings / analysisYears; // Use actual analysis period
  
  const roiData: { year: number; cumulative: number; breakeven: boolean; capex?: number }[] = [];
  
  // Year 0 = starting point (no investment yet)
  roiData.push({
    year: 0,
    cumulative: 0,
    breakeven: true,
    capex: Math.round(avgCapex), // Store CAPEX for reference
  });
  
  // Year 1 starts with the investment cost + first year's savings
  let cumulative = -avgCapex; // Investment at start of Year 1
  
  for (let year = 1; year <= analysisYears; year++) {
    cumulative += annualSavings;
    roiData.push({
      year,
      cumulative: Math.round(cumulative),
      breakeven: cumulative >= 0,
    });
  }
  
  return roiData;
}

// generateDynamicSensitivityData has been removed - sensitivity analysis is now handled by useRiskAnalysis hook

// Generate annual OPEX breakdown from tco_results
function generateAnnualOpexBreakdown(tcoResults: any[], scenarios: any[]): AnnualOpexBreakdown[] {
  if (tcoResults.length === 0) return [];

  // Calculate average analysis years from scenarios
  const avgAnalysisYears = scenarios.length > 0
    ? Math.round(scenarios.reduce((sum, s) => sum + (s.analysis_years || 10), 0) / scenarios.length)
    : 10;

  // Aggregate totals from all tco_results
  let totalFuel = 0;
  let totalMaintenance = 0;
  let totalInsurance = 0;
  let totalOther = 0;

  tcoResults.forEach(result => {
    const byType = result.by_vehicle_type;
    if (byType && typeof byType === 'object') {
      // Sum fuel costs from all vehicle types
      Object.values(byType).forEach((type: any) => {
        if (type && typeof type === 'object') {
          totalFuel += type.fuelCost || type.energyCost || 0;
          totalMaintenance += type.maintenanceCost || 0;
          totalInsurance += type.insuranceCost || 0;
        }
      });
    }
    // Add other costs
    totalOther += (result.downtime_cost || 0) + (result.telematics_cost || 0) + (result.grid_demand_cost || 0);
  });

  // If no breakdown available, estimate from opex_total
  if (totalFuel === 0 && totalMaintenance === 0) {
    const totalOpex = tcoResults.reduce((sum, r) => sum + (r.opex_total || 0), 0);
    // Typical distribution: 60% fuel, 25% maintenance, 10% insurance, 5% other
    totalFuel = totalOpex * 0.60;
    totalMaintenance = totalOpex * 0.25;
    totalInsurance = totalOpex * 0.10;
    totalOther = totalOpex * 0.05;
  }

  // Distribute across years with slight annual variation
  const breakdown: AnnualOpexBreakdown[] = [];
  for (let year = 1; year <= avgAnalysisYears; year++) {
    // Apply slight annual inflation (2% per year)
    const inflationFactor = Math.pow(1.02, year - 1);
    const yearFuel = (totalFuel / avgAnalysisYears) * inflationFactor;
    const yearMaintenance = (totalMaintenance / avgAnalysisYears) * inflationFactor;
    const yearInsurance = (totalInsurance / avgAnalysisYears) * inflationFactor;
    const yearOther = (totalOther / avgAnalysisYears) * inflationFactor;

    breakdown.push({
      year,
      fuelCost: Math.round(yearFuel),
      maintenanceCost: Math.round(yearMaintenance),
      insuranceCost: Math.round(yearInsurance),
      otherCost: Math.round(yearOther),
      total: Math.round(yearFuel + yearMaintenance + yearInsurance + yearOther),
    });
  }

  return breakdown;
}
