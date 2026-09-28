import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Percent,
  Plus,
  FolderKanban,
  ArrowRight,
  Users,
  CheckSquare,
  Map as MapIcon,
  FileText,
} from "lucide-react";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShareProjectButton } from "@/components/collaboration";
import { ComparisonPDFDownloadButton } from "@/components/reports";
import { TaskBoard } from "@/components/tasks";
import { useTasks } from "@/hooks/useTasks";
import { useProjectRoadmaps } from "@/hooks/useRoadmap";
import { formatCurrency } from "@/lib/currency";

import { useAuth } from "@/hooks/useAuth";
import { useProjectCollaborators } from "@/hooks/useProjectCollaborators";
import { toast } from "@/hooks/use-toast";
import { availableRegions } from "@/data/mockData";

import { getProjectById, type ProjectDTO } from "@/lib/supabase/projects";
import { listScenarios } from "@/lib/supabase/scenarios";
import { supabase } from "@/integrations/supabase/client";

type ScenarioListItem = {
  id: string;
  name: string;
  region: string;
  analysisYears: number;
  discountRate: number;
  createdAt: string;
};

type ScenarioWithResult = {
  id: string;
  name: string;
  region: string;
  tco_result?: {
    tco_total: number;
    tco_per_km: number;
    capex: number;
    opex_total: number;
    co2_total: number;
    co2_savings_percent: number;
    npv: number;
    payback_period_years: number | null;
  };
};

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { collaborators, myRole } = useProjectCollaborators(projectId);
  const { stats: taskStats } = useTasks(projectId);
  const { data: roadmaps, isLoading: roadmapsLoading } = useProjectRoadmaps(projectId);
  const hasRoadmaps = roadmaps && roadmaps.length > 0;

  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [scenariosWithResults, setScenariosWithResults] = useState<ScenarioWithResult[]>([]);
  
  const hasCollaborators = collaborators.length > 1;
  
  // Active tab from URL or default
  const activeTab = searchParams.get("tab") || "overview";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  useEffect(() => {
    if (!projectId || !user) return;

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);

        const [p, s] = await Promise.all([
          getProjectById(projectId),
          listScenarios(projectId),
        ]);

        if (cancelled) return;

        setProject(p);
        setScenarios(
          s.map((x) => ({
            id: x.id,
            name: x.name,
            region: x.region,
            analysisYears: x.analysisYears,
            discountRate: x.discountRate,
            createdAt: x.createdAt,
          }))
        );

        // Fetch TCO results for each scenario
        const scenarioIds = s.map((x) => x.id);
        if (scenarioIds.length > 0) {
          const { data: tcoResults } = await supabase
            .from('tco_results')
            .select('scenario_id, tco_total, tco_per_km, capex, opex_total, co2_total, co2_savings_percent, npv, payback_period_years')
            .in('scenario_id', scenarioIds);

          const resultsMap = new Map(
            (tcoResults || []).map((r) => [r.scenario_id, r])
          );

          setScenariosWithResults(
            s.map((x) => ({
              id: x.id,
              name: x.name,
              region: x.region,
              tco_result: resultsMap.get(x.id) ? {
                tco_total: resultsMap.get(x.id)!.tco_total,
                tco_per_km: resultsMap.get(x.id)!.tco_per_km,
                capex: resultsMap.get(x.id)!.capex,
                opex_total: resultsMap.get(x.id)!.opex_total,
                co2_total: resultsMap.get(x.id)!.co2_total,
                co2_savings_percent: resultsMap.get(x.id)!.co2_savings_percent,
                npv: resultsMap.get(x.id)!.npv,
                payback_period_years: resultsMap.get(x.id)!.payback_period_years,
              } : undefined,
            }))
          );
        }

        document.title = p ? `${p.name} | H2Fleet` : "Projet | H2Fleet";
      } catch (error) {
        console.error("Error loading project:", error);
        toast({
          title: t('common.error'),
          description: t('projects.errors.loadFailed'),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, user?.id]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <Skeleton className="h-10 w-80" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-xl font-semibold mb-2">{t('common.projectNotFound', 'Project not found')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('projects.notFoundMessage', 'The requested project does not exist, has been deleted, or does not belong to you.')}
          </p>
          <Button asChild>
            <Link to="/dashboard/projects">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('common.backToHome', 'Back to projects')}
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const region = availableRegions.find((r) => r.value === project.countryOrRegion);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard/projects">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <p className="text-muted-foreground">{project.description || ""}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <ShareProjectButton projectId={project.id} />
            {scenariosWithResults.filter(s => s.tco_result).length >= 2 && (
              <ComparisonPDFDownloadButton 
                scenarios={scenariosWithResults.filter(s => s.tco_result)}
                projectName={project.name}
              />
            )}
            <Button asChild className="gap-2">
              <Link to={`/dashboard/projects/${project.id}/scenarios/new`}>
                <Plus className="w-4 h-4" />
                {t("pages.projectDetail.newScenario", "Nouveau scénario TCO")}
              </Link>
            </Button>
          </div>
        </div>

        {/* Project meta */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <MapPin className="w-3 h-3" />
            {region?.label || project.countryOrRegion}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Calendar className="w-3 h-3" />
            {project.defaultAnalysisHorizonYears} {t("common.years", "ans")}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Percent className="w-3 h-3" />
            {(project.defaultDiscountRate * 100).toFixed(1)}%
          </Badge>
          {hasCollaborators && (
            <Badge variant="outline" className="gap-1">
              <Users className="w-3 h-3" />
              {t("collaboration.shared", "Partagé")} ({collaborators.length})
            </Badge>
          )}
        </div>

        {/* Tabs for navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <FolderKanban className="w-4 h-4" />
              {t('projects.detail.overview')}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="w-4 h-4" />
              {t('projects.detail.tasks')}
              {taskStats.total > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {taskStats.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="gap-2">
              <MapIcon className="w-4 h-4" />
              {t('projects.detail.roadmap')}
              {hasRoadmaps && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {roadmaps.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('projects.detail.scenarios')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{scenarios.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('projects.detail.tasks')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {taskStats.completed}/{taskStats.total}
                    <span className="text-sm font-normal text-muted-foreground ml-2">{t('projects.detail.completed')}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('projects.detail.collaborators')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{collaborators.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Scenarios List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderKanban className="w-5 h-5" />
                  {t('projects.detail.scenarios')}
                </CardTitle>
                <Button variant="ghost" size="sm" asChild className="gap-1">
                  <Link to="/dashboard/scenarios">
                    {t('projects.detail.viewAll')}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {scenarios.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {t('projects.detail.noScenarios')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scenarios.slice(0, 5).map((s) => (
                      <Link
                        key={s.id}
                        to={`/dashboard/scenarios/${s.id}/results`}
                        className="block rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium text-foreground">{s.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.region} • {s.analysisYears} ans
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="min-h-[600px]">
            <TaskBoard projectId={project.id} />
          </TabsContent>

          {/* Roadmap Tab */}
          <TabsContent value="roadmap">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapIcon className="w-5 h-5" />
                  {t('projects.detail.transitionRoadmap')}
                </CardTitle>
                <Button asChild className="gap-2">
                  <Link to={`/dashboard/roadmap?projectId=${project.id}`}>
                    {hasRoadmaps ? t('projects.detail.manageRoadmaps') : t('projects.detail.createRoadmap')}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {roadmapsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : hasRoadmaps ? (
                  <div className="space-y-3">
                    {roadmaps.map((roadmap) => {
                      const statusLabels: Record<string, string> = {
                        draft: t('projects.detail.statusLabels.draft'),
                        active: t('projects.detail.statusLabels.active'),
                        completed: t('projects.detail.statusLabels.completed'),
                        archived: t('projects.detail.statusLabels.archived'),
                      };
                      const statusVariant = roadmap.status === 'active' ? 'default' : 'secondary';

                      return (
                        <Link
                          key={roadmap.id}
                          to={`/dashboard/roadmap?projectId=${project.id}&roadmapId=${roadmap.id}`}
                          className="block rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-foreground">{roadmap.name}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(roadmap.start_date), 'dd MMM yyyy', { locale: fr })} → {format(new Date(roadmap.end_date), 'dd MMM yyyy', { locale: fr })}
                              </div>
                              {roadmap.description && (
                                <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                  {roadmap.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={statusVariant}>
                                {statusLabels[roadmap.status] || roadmap.status}
                              </Badge>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                          {roadmap.total_budget && (
                            <div className="text-sm text-muted-foreground mt-2">
                              Budget: {formatCurrency(roadmap.total_budget, 'QC' as any)}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                    <MapIcon className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      {t('projects.detail.noRoadmap')}
                    </p>
                    <Button asChild className="mt-4 gap-2">
                      <Link to={`/dashboard/roadmap?projectId=${project.id}`}>
                        <Plus className="w-4 h-4" />
                        {t('projects.detail.createRoadmap')}
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
