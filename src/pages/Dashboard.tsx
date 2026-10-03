/**
 * Accueil (D1) — branché sur les données RÉELLES : la flotte de
 * l'organisation (« Ma flotte »), les projets visibles (RLS) et les
 * sélections du parcours (project_vehicles). Plus aucune lecture des
 * anciens scénarios / tco_results ni de chiffre agrégé non calculé par
 * le moteur : les résultats chiffrés vivent dans les étapes du parcours.
 */
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, FolderKanban, Leaf, Plus, Route, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Page, PageHeader } from "@/components/layout/Page";
import { SubscriptionBadge } from "@/components/dashboard/SubscriptionBadge";
import RecommendedActionsCard from "@/components/dashboard/RecommendedActionsCard";
import PlanHealthCard from "@/components/dashboard/PlanHealthCard";
import ReceivedInvitationsCard from "@/components/organization/ReceivedInvitationsCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useOrganization } from "@/hooks/useOrganization";
import { useVehicles } from "@/hooks/useVehicles";
import { listProjects } from "@/lib/supabase/projects";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { StatCard, StatGrid } from "@/components/layout/StatCard";
import { LoadingState } from "@/components/layout/States";

const COULEURS_CARBURANT: Record<string, string> = {
  diesel: "hsl(var(--chart-diesel))",
  essence: "hsl(var(--muted-foreground))",
  bev: "hsl(var(--chart-ev))",
  fcev: "hsl(var(--chart-h2))",
};

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { unreadCount, isLoading: notificationsLoading } = useNotifications();
  const { user } = useAuth();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { vehicles, isLoading: fleetLoading } = useVehicles(organization?.id);

  useEffect(() => {
    document.title = `${t("pages.dashboard.title")} | H2Fleet`;
  }, [t]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["dashboard-projects", user?.id],
    queryFn: listProjects,
    enabled: !!user?.id,
  });

  const { data: selections = [], isLoading: selectionsLoading } = useQuery({
    queryKey: ["dashboard-selections", projects.map((p) => p.id).join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_vehicles")
        .select("project_id, target_technology, completed_date")
        .in("project_id", projects.map((p) => p.id));
      if (error) throw error;
      return data ?? [];
    },
    enabled: projects.length > 0,
  });

  const loading = orgLoading || fleetLoading || projectsLoading || selectionsLoading;

  const stats = useMemo(() => {
    const actifs = vehicles.filter((v) => v.status === "actif").length;
    const zeroEmission = vehicles.filter((v) => v.fuel_type === "bev" || v.fuel_type === "fcev").length;
    const ciblesZe = selections.filter(
      (s) => s.target_technology === "bev" || s.target_technology === "fcev",
    ).length;
    const realises = selections.filter((s) => s.completed_date).length;
    return { actifs, zeroEmission, ciblesZe, realises };
  }, [vehicles, selections]);

  const repartition = useMemo(() => {
    const parCarburant = new Map<string, number>();
    for (const v of vehicles) {
      parCarburant.set(v.fuel_type, (parCarburant.get(v.fuel_type) ?? 0) + 1);
    }
    const total = vehicles.length;
    if (total === 0) return [];
    return [...parCarburant.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([carburant, n]) => ({
        name: t(`fleet.fuels.${carburant}`),
        count: n,
        value: Math.round((n / total) * 100),
        color: COULEURS_CARBURANT[carburant] ?? "hsl(var(--primary))",
      }));
  }, [vehicles, t]);

  const vehiculesParProjet = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of selections) m.set(s.project_id, (m.get(s.project_id) ?? 0) + 1);
    return m;
  }, [selections]);

  const locale = i18n.language === "en" ? "en-CA" : "fr-CA";

  if (loading) {
    return (
      <DashboardLayout>
        <Page>
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <LoadingState variante="cartes" />
        </Page>
      </DashboardLayout>
    );
  }

  const statsCards = [
    {
      title: t("pages.dashboard.stats.fleetVehicles"),
      value: vehicles.length,
      detail: t("pages.dashboard.stats.fleetActive", { count: stats.actifs }),
      icon: Truck,
      color: "bg-chart-diesel/10 text-chart-diesel",
      href: "/dashboard/fleet",
    },
    {
      title: t("pages.dashboard.stats.zeroEmissionToday"),
      value: stats.zeroEmission,
      detail: t("pages.dashboard.stats.zeroEmissionTargeted", { count: stats.ciblesZe }),
      icon: Leaf,
      color: "bg-accent/10 text-accent",
      href: "/dashboard/fleet",
    },
    {
      title: t("pages.dashboard.stats.projects"),
      value: projects.length,
      detail: t("pages.dashboard.stats.plannedVehicles", { count: selections.length }),
      icon: FolderKanban,
      color: "bg-primary/10 text-primary",
      href: "/dashboard/projects",
    },
    {
      title: t("pages.dashboard.stats.completedReplacements"),
      value: stats.realises,
      detail: t("pages.dashboard.stats.completedOf", { count: selections.length }),
      icon: Route,
      color: "bg-chart-ev/10 text-chart-ev",
      href: "/dashboard/projects",
    },
  ];

  return (
    <DashboardLayout>
      <Page>
        <PageHeader
          titre={t("pages.dashboard.title")}
          badge={<SubscriptionBadge />}
          sousTitre={organization ? t("pages.dashboard.subtitleOrg", { org: organization.name }) : t("pages.dashboard.subtitle")}
          actions={
            <>
              {!notificationsLoading && (
                <Button variant="ghost" asChild>
                  <Link to="/dashboard/notifications" data-testid="home-unread" data-count={unreadCount}>
                    <Bell className="w-4 h-4 mr-2" />
                    {unreadCount > 0 ? t("notifications.homeUnread", { count: unreadCount }) : t("notifications.homeNone")}
                  </Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/dashboard/fleet">
                  <Truck className="w-4 h-4 mr-2" />
                  {t("pages.dashboard.openFleet")}
                </Link>
              </Button>
              <Button asChild>
                <Link to="/dashboard/projects?create=true">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("pages.dashboard.newProject")}
                </Link>
              </Button>
            </>
          }
        />

        <StatGrid>
          {statsCards.map((stat) => (
            <StatCard
              key={stat.title}
              vers={stat.href}
              icone={stat.icon}
              classeIcone={stat.color}
              libelle={stat.title}
              valeur={stat.value.toLocaleString(locale)}
              detail={stat.detail}
            />
          ))}
        </StatGrid>

        <ReceivedInvitationsCard />

        {projects.length > 0 && <PlanHealthCard projects={projects} />}

        <RecommendedActionsCard />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{t("pages.dashboard.charts.fleetDistribution")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("pages.dashboard.charts.fleetDistributionSource")}</p>
            </CardHeader>
            <CardContent>
              {repartition.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground">{t("pages.dashboard.charts.emptyFleet")}</p>
                  <Button variant="outline" asChild>
                    <Link to="/dashboard/fleet">{t("pages.dashboard.openFleet")}</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={repartition} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="count">
                          {repartition.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {repartition.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-muted-foreground">{item.name}</span>
                        <span className="text-sm font-medium ml-auto">
                          {item.count} ({item.value} %)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">{t("pages.dashboard.recentProjects.title")}</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1" asChild>
                <Link to="/dashboard/projects">
                  {t("pages.dashboard.recentProjects.viewAll")}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground">{t("pages.dashboard.recentProjects.noProjects")}</p>
                  <Button asChild>
                    <Link to="/dashboard/projects?create=true">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("pages.dashboard.createFirstProject")}
                    </Link>
                  </Button>
                </div>
              ) : (
                projects.slice(0, 5).map((project) => {
                  const nb = vehiculesParProjet.get(project.id) ?? 0;
                  return (
                    <Link
                      key={project.id}
                      to={`/dashboard/projects/${project.id}/${nb > 0 ? "plan" : "flotte"}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("pages.dashboard.recentProjects.vehicles", { count: nb })} •{" "}
                          {t("pages.dashboard.recentProjects.updated")}{" "}
                          {new Date(project.updatedAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </Page>
    </DashboardLayout>
  );
};

export default Dashboard;
