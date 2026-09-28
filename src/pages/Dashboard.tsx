import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { 
  TrendingUp, 
  TrendingDown, 
  Truck, 
  Leaf, 
  Zap, 
  FolderKanban,
  ArrowRight,
  MoreHorizontal,
  Calculator,
  Download,
  Plus
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ReferenceDataStatusCard from "@/components/dashboard/ReferenceDataStatusCard";
import { SubscriptionBadge } from "@/components/dashboard/SubscriptionBadge";
import RecommendedActionsCard from "@/components/dashboard/RecommendedActionsCard";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from "recharts";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface FleetComposition {
  diesel?: { count: number; annualKm: number };
  ev?: { count: number; annualKm: number };
  hydrogen?: { count: number; annualKm: number };
}

interface Scenario {
  id: string;
  name: string;
  project_id: string;
  fleet_composition: FleetComposition;
}

interface TCOResult {
  id: string;
  scenario_id: string;
  tco_total: number;
  co2_total: number;
  co2_savings: number | null;
}

interface DashboardStats {
  projectCount: number;
  vehicleCount: number;
  co2Savings: number;
  tcoSavings: number;
}

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tier, status, canAccessFeature } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [tcoResults, setTcoResults] = useState<TCOResult[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    projectCount: 0,
    vehicleCount: 0,
    co2Savings: 0,
    tcoSavings: 0,
  });

  useEffect(() => {
    if (!user) return;
    fetchDashboardData(user.id);
  }, [user?.id]);

  const fetchDashboardData = async (userId: string) => {
    try {
      setLoading(true);

      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      if (projectsData && projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id);

        const { data: scenariosData, error: scenariosError } = await supabase
          .from("scenarios")
          .select("*")
          .in("project_id", projectIds);

        if (scenariosError) throw scenariosError;
        
        const mappedScenarios: Scenario[] = (scenariosData || []).map(s => ({
          id: s.id,
          name: s.name,
          project_id: s.project_id,
          fleet_composition: s.fleet_composition as FleetComposition,
        }));
        setScenarios(mappedScenarios);

        if (scenariosData && scenariosData.length > 0) {
          const scenarioIds = scenariosData.map(s => s.id);
          const { data: tcoData, error: tcoError } = await supabase
            .from("tco_results")
            .select("*")
            .in("scenario_id", scenarioIds)
            .eq("is_current", true);

          if (tcoError) throw tcoError;
          setTcoResults(tcoData || []);

          // Phase 2d : une flotte comptée UNE fois par projet — on retient
          // le scénario le plus récent de chaque projet (sinon 3 scénarios
          // d'un même projet de 40 véhicules affichaient 120 véhicules).
          const representatifParProjet = new Map<string, (typeof scenariosData)[number]>();
          scenariosData.forEach((s) => {
            const courant = representatifParProjet.get(s.project_id);
            if (!courant || new Date(s.created_at) > new Date(courant.created_at)) {
              representatifParProjet.set(s.project_id, s);
            }
          });
          const representatifs = Array.from(representatifParProjet.values());
          const idsRepresentatifs = new Set(representatifs.map((s) => s.id));

          const totalVehicles = representatifs.reduce((acc, s) => {
            const composition = s.fleet_composition as Scenario['fleet_composition'];
            return acc +
              (composition?.diesel?.count || 0) +
              (composition?.ev?.count || 0) +
              (composition?.hydrogen?.count || 0);
          }, 0);

          const totalCo2Savings = (tcoData || [])
            .filter((r) => idsRepresentatifs.has(r.scenario_id))
            .reduce((acc, r) => acc + (r.co2_savings || 0), 0);

          setStats({
            projectCount: projectsData.length,
            vehicleCount: totalVehicles,
            co2Savings: Math.round(totalCo2Savings),
            tcoSavings: 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: t('pages.dashboard.toast.error'),
        description: t('pages.dashboard.toast.errorLoading'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    if (projects.length === 0) {
      toast({
        title: t('pages.dashboard.toast.noData'),
        description: t('pages.dashboard.toast.noDataToExport'),
        variant: "destructive",
      });
      return;
    }

    let csvContent = "H2Fleet Dashboard Export\n";
    csvContent += `${t('pages.dashboard.toast.exportSuccess')}: ${new Date().toLocaleDateString()}\n\n`;
    
    csvContent += "=== PROJECTS ===\n";
    csvContent += "Name,Description,Created,Updated\n";
    projects.forEach(project => {
      csvContent += `"${project.name}","${project.description || ''}",${new Date(project.created_at).toLocaleDateString()},${new Date(project.updated_at).toLocaleDateString()}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `h2fleet-dashboard-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: t('pages.dashboard.toast.exportSuccess'),
      description: t('pages.dashboard.toast.exportSuccessDesc'),
    });
  };

  const getFleetDistribution = () => {
    let diesel = 0, ev = 0, hydrogen = 0;
    
    scenarios.forEach(s => {
      const composition = s.fleet_composition as Scenario['fleet_composition'];
      diesel += composition?.diesel?.count || 0;
      ev += composition?.ev?.count || 0;
      hydrogen += composition?.hydrogen?.count || 0;
    });

    const total = diesel + ev + hydrogen;
    if (total === 0) return [];

    return [
      { name: t('pages.dashboard.charts.diesel'), value: Math.round((diesel / total) * 100), color: "hsl(var(--chart-diesel))" },
      { name: t('pages.dashboard.charts.electric'), value: Math.round((ev / total) * 100), color: "hsl(var(--chart-ev))" },
      { name: t('pages.dashboard.charts.hydrogen'), value: Math.round((hydrogen / total) * 100), color: "hsl(var(--chart-h2))" },
    ].filter(item => item.value > 0);
  };

  const fleetDistribution = getFleetDistribution();

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <FolderKanban className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{t('pages.dashboard.welcomeTitle')}</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        {t('pages.dashboard.welcomeSubtitle')}
      </p>
      <Button asChild size="lg">
        <Link to="/dashboard/projects?create=true">
          <Plus className="w-5 h-5 mr-2" />
          {t('pages.dashboard.createFirstProject')}
        </Link>
      </Button>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-10 w-10 rounded-xl mb-4" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (projects.length === 0) {
    return (
      <DashboardLayout>
        <EmptyState />
      </DashboardLayout>
    );
  }

  const statsCards = [
    {
      title: t('pages.dashboard.stats.activeProjects'),
      value: stats.projectCount.toString(),
      change: "",
      trend: "up" as const,
      icon: FolderKanban,
      color: "bg-primary/10 text-primary",
    },
    {
      title: t('pages.dashboard.stats.modeledVehicles'),
      value: stats.vehicleCount.toString(),
      change: "",
      trend: "up" as const,
      icon: Truck,
      color: "bg-chart-diesel/10 text-chart-diesel",
    },
    {
      title: t('pages.dashboard.stats.co2Avoided'),
      value: stats.co2Savings.toLocaleString(),
      change: "",
      trend: "up" as const,
      icon: Leaf,
      color: "bg-accent/10 text-accent",
    },
    {
      title: t('pages.dashboard.stats.scenariosCreated'),
      value: scenarios.length.toString(),
      change: "",
      trend: "up" as const,
      icon: Calculator,
      color: "bg-chart-ev/10 text-chart-ev",
    },
  ];

  const recentProjects = projects.slice(0, 4).map(p => ({
    id: p.id,
    name: p.name,
    scenarioCount: scenarios.filter(s => s.project_id === p.id).length,
    updatedAt: new Date(p.updated_at).toLocaleDateString(),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{t('pages.dashboard.title')}</h1>
              <SubscriptionBadge />
            </div>
            <p className="text-muted-foreground">{t('pages.dashboard.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExportData} className="gap-2">
              <Download className="w-4 h-4" />
              {t('pages.dashboard.exportData')}
            </Button>
            <Button asChild>
              <Link to="/dashboard/scenarios">
                <Calculator className="w-4 h-4 mr-2" />
                {t('pages.dashboard.calculateTco')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  {stat.change && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      stat.trend === "up" ? "text-accent" : "text-destructive"
                    }`}>
                      {stat.trend === "up" ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {stat.change}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recommended Actions */}
        <RecommendedActionsCard />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {fleetDistribution.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">{t('pages.dashboard.charts.fleetDistribution')}</CardTitle>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fleetDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {fleetDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {fleetDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                      <span className="text-sm font-medium ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                {t('pages.dashboard.tcoSection.title')}
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1" asChild>
                <Link to="/dashboard/scenarios">
                  {t('pages.dashboard.tcoSection.open')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('pages.dashboard.tcoSection.subtitle')}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background rounded-lg">
                  <p className="text-2xl font-bold text-primary">{scenarios.length}</p>
                  <p className="text-xs text-muted-foreground">{t('pages.dashboard.tcoSection.created')}</p>
                </div>
                <div className="p-3 bg-background rounded-lg">
                  <p className="text-2xl font-bold text-accent">
                    {stats.co2Savings > 0 ? `-${Math.round(stats.co2Savings)}t` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('pages.dashboard.tcoSection.co2Avoided')}</p>
                </div>
              </div>
              <Button className="w-full" asChild>
                <Link to="/dashboard/scenarios">
                  <Zap className="w-4 h-4 mr-2" />
                  {t('pages.dashboard.tcoSection.newCalculation')}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">{t('pages.dashboard.recentProjects.title')}</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1" asChild>
                <Link to="/dashboard/projects">
                  {t('pages.dashboard.recentProjects.viewAll')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('pages.dashboard.recentProjects.noProjects')}
                </p>
              ) : (
                recentProjects.map((project) => (
                  <Link 
                    key={project.id} 
                    to={`/dashboard/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.scenarioCount} {t('pages.dashboard.recentProjects.scenarios')} • {t('pages.dashboard.recentProjects.updated')} {project.updatedAt}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;