import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AnalyticsMetrics {
  totalProjects: number;
  activeScenarios: number;
  totalVehicles: number;
  co2Reduction: number;
  projectsThisMonth: number;
  scenariosThisMonth: number;
}

interface ProjectsByMonth {
  month: string;
  projects: number;
}

interface VehicleDistribution {
  name: string;
  value: number;
  color: string;
}

interface FleetTransitionData {
  month: string;
  electric: number;
  hydrogen: number;
  diesel: number;
}

interface AnalyticsData {
  metrics: AnalyticsMetrics;
  projectsByMonth: ProjectsByMonth[];
  vehicleDistribution: VehicleDistribution[];
  fleetTransition: FleetTransitionData[];
  hasData: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAnalyticsData(): AnalyticsData {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData>({
    metrics: {
      totalProjects: 0,
      activeScenarios: 0,
      totalVehicles: 0,
      co2Reduction: 0,
      projectsThisMonth: 0,
      scenariosThisMonth: 0,
    },
    projectsByMonth: [],
    vehicleDistribution: [],
    fleetTransition: [],
    hasData: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!user?.id) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const fetchAnalytics = async () => {
      try {
        // Fetch projects
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id, created_at")
          .eq("user_id", user.id);

        if (projectsError) throw projectsError;

        const projectIds = projects?.map(p => p.id) || [];

        // Fetch scenarios for user's projects
        let scenarios: any[] = [];
        let tcoResults: any[] = [];

        if (projectIds.length > 0) {
          const { data: scenariosData, error: scenariosError } = await supabase
            .from("scenarios")
            .select("id, created_at, fleet_composition, project_id")
            .in("project_id", projectIds);

          if (scenariosError) throw scenariosError;
          scenarios = scenariosData || [];

          // Fetch TCO results for CO2 data
          const scenarioIds = scenarios.map(s => s.id);
          if (scenarioIds.length > 0) {
            const { data: tcoData, error: tcoError } = await supabase
              .from("tco_results")
              .select("scenario_id, co2_savings, co2_total")
              .in("scenario_id", scenarioIds);

            if (tcoError) throw tcoError;
            tcoResults = tcoData || [];
          }
        }

        // Calculate metrics
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const projectsThisMonth = projects?.filter(
          p => new Date(p.created_at) >= startOfMonth
        ).length || 0;

        const scenariosThisMonth = scenarios.filter(
          s => new Date(s.created_at) >= startOfMonth
        ).length;

        // Calculate total vehicles from fleet composition
        let totalVehicles = 0;
        let totalElectric = 0;
        let totalHydrogen = 0;
        let totalDiesel = 0;

        scenarios.forEach(scenario => {
          const fleet = scenario.fleet_composition as any;
          if (fleet) {
            const evCount = fleet.ev?.count || 0;
            const h2Count = fleet.hydrogen?.count || 0;
            const dieselCount = fleet.diesel?.count || 0;
            
            totalElectric += evCount;
            totalHydrogen += h2Count;
            totalDiesel += dieselCount;
            totalVehicles += evCount + h2Count + dieselCount;
          }
        });

        // Calculate CO2 reduction
        const totalCo2Savings = tcoResults.reduce(
          (sum, result) => sum + (result.co2_savings || 0),
          0
        );

        // Projects by month (last 6 months)
        const projectsByMonth: ProjectsByMonth[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          const monthName = date.toLocaleDateString("en-US", { month: "short" });
          
          const count = projects?.filter(p => {
            const created = new Date(p.created_at);
            return created >= date && created <= monthEnd;
          }).length || 0;

          projectsByMonth.push({ month: monthName, projects: count });
        }

        // Vehicle distribution
        const totalFleetVehicles = totalElectric + totalHydrogen + totalDiesel;
        const vehicleDistribution: VehicleDistribution[] = totalFleetVehicles > 0
          ? [
              { name: "Electric", value: totalElectric, color: "hsl(142, 76%, 36%)" },
              { name: "Hydrogen", value: totalHydrogen, color: "hsl(217, 91%, 60%)" },
              { name: "Diesel", value: totalDiesel, color: "hsl(0, 0%, 45%)" },
            ].filter(v => v.value > 0)
          : [];

        // Fleet transition (from scenarios over time)
        const fleetTransition: FleetTransitionData[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          const monthName = date.toLocaleDateString("en-US", { month: "short" });

          const monthScenarios = scenarios.filter(s => {
            const created = new Date(s.created_at);
            return created <= monthEnd;
          });

          let ev = 0, h2 = 0, diesel = 0;
          monthScenarios.forEach(scenario => {
            const fleet = scenario.fleet_composition as any;
            if (fleet) {
              ev += fleet.ev?.count || 0;
              h2 += fleet.hydrogen?.count || 0;
              diesel += fleet.diesel?.count || 0;
            }
          });

          const total = ev + h2 + diesel;
          if (total > 0) {
            fleetTransition.push({
              month: monthName,
              electric: Math.round((ev / total) * 100),
              hydrogen: Math.round((h2 / total) * 100),
              diesel: Math.round((diesel / total) * 100),
            });
          } else {
            fleetTransition.push({
              month: monthName,
              electric: 0,
              hydrogen: 0,
              diesel: 0,
            });
          }
        }

        const hasData = (projects?.length || 0) > 0;

        setData({
          metrics: {
            totalProjects: projects?.length || 0,
            activeScenarios: scenarios.length,
            totalVehicles,
            co2Reduction: Math.round(totalCo2Savings),
            projectsThisMonth,
            scenariosThisMonth,
          },
          projectsByMonth,
          vehicleDistribution,
          fleetTransition,
          hasData,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        console.error("Error fetching analytics:", err);
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    };

    fetchAnalytics();
  }, [user?.id]);

  return data;
}
