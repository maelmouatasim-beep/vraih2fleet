/**
 * D1 — Actions recommandées de l'Accueil, branchées sur les données
 * RÉELLES : la flotte de l'organisation (« Ma flotte »), les projets
 * visibles (RLS) et les sélections du parcours (project_vehicles).
 * Plus aucune référence aux anciens scénarios ni aux routes retirées.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarClock, FolderPlus, Route, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useVehicles } from "@/hooks/useVehicles";
import { listProjects } from "@/lib/supabase/projects";

export interface RecommendedAction {
  id: string;
  type: "fleet" | "project" | "journey" | "data";
  priority: "urgent" | "high" | "medium";
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  badge?: { text: string; variant: "destructive" | "warning" | "secondary" };
}

export function useRecommendedActions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { vehicles, isLoading: fleetLoading } = useVehicles(organization?.id);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["recommended-actions-projects", user?.id],
    queryFn: listProjects,
    enabled: !!user?.id,
  });

  // Sélections du parcours : quels projets ont déjà des véhicules ?
  const { data: selections = [], isLoading: selectionsLoading } = useQuery({
    queryKey: ["recommended-actions-selections", projects.map((p) => p.id).join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_vehicles")
        .select("project_id, replacement_year, target_technology")
        .in("project_id", projects.map((p) => p.id));
      if (error) throw error;
      return data ?? [];
    },
    enabled: projects.length > 0,
  });

  const isLoading = orgLoading || fleetLoading || projectsLoading || selectionsLoading;

  const actions = useMemo(() => {
    const result: RecommendedAction[] = [];

    // 1. Flotte vide → tout commence par « Ma flotte »
    if (vehicles.length === 0) {
      result.push({
        id: "describe-fleet",
        type: "fleet",
        priority: "high",
        icon: Truck,
        title: t("recommendedActions.describeFleet.title"),
        description: t("recommendedActions.describeFleet.description"),
        actionLabel: t("recommendedActions.describeFleet.action"),
        href: "/dashboard/fleet",
      });
    }

    // 2. Aucun projet → créer le premier (parcours 7 étapes)
    if (projects.length === 0) {
      result.push({
        id: "create-first-project",
        type: "project",
        priority: vehicles.length > 0 ? "high" : "medium",
        icon: FolderPlus,
        title: t("recommendedActions.createFirstProject.title"),
        description: t("recommendedActions.createFirstProject.description"),
        actionLabel: t("recommendedActions.createFirstProject.action"),
        href: "/dashboard/projects?create=true",
      });
      return result;
    }

    // 3. Projets sans véhicules sélectionnés → étape 1 du parcours
    const projetsAvecSelection = new Set(selections.map((s) => s.project_id));
    for (const project of projects) {
      if (!projetsAvecSelection.has(project.id)) {
        result.push({
          id: `select-vehicles-${project.id}`,
          type: "journey",
          priority: "high",
          icon: Route,
          title: t("recommendedActions.selectVehicles.title", { project: project.name }),
          description: t("recommendedActions.selectVehicles.description"),
          actionLabel: t("recommendedActions.selectVehicles.action"),
          href: `/dashboard/projects/${project.id}/flotte`,
        });
      }
    }

    // 4. Sélections incomplètes (année ou cible manquante) → étape Flotte
    const incompletsParProjet = new Map<string, number>();
    for (const s of selections) {
      if (s.replacement_year == null || !s.target_technology) {
        incompletsParProjet.set(s.project_id, (incompletsParProjet.get(s.project_id) ?? 0) + 1);
      }
    }
    for (const [projectId, nb] of incompletsParProjet) {
      const project = projects.find((p) => p.id === projectId);
      if (!project) continue;
      result.push({
        id: `complete-plan-${projectId}`,
        type: "journey",
        priority: "medium",
        icon: CalendarClock,
        title: t("recommendedActions.completePlan.title", { project: project.name }),
        description: t("recommendedActions.completePlan.description", { count: nb }),
        actionLabel: t("recommendedActions.completePlan.action"),
        href: `/dashboard/projects/${projectId}/flotte`,
        badge: { text: String(nb), variant: "secondary" },
      });
    }

    // 5. Consommations estimées → les préciser améliore la crédibilité
    const estimations = vehicles.filter((v) => v.consumption_source === "estimation").length;
    if (estimations > 0) {
      result.push({
        id: "refine-consumptions",
        type: "data",
        priority: "medium",
        icon: Truck,
        title: t("recommendedActions.refineConsumptions.title"),
        description: t("recommendedActions.refineConsumptions.description", { count: estimations }),
        actionLabel: t("recommendedActions.refineConsumptions.action"),
        href: "/dashboard/fleet",
      });
    }

    const priorityOrder = { urgent: 0, high: 1, medium: 2 };
    return result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5);
  }, [vehicles, projects, selections, t]);

  return { actions, isLoading, totalActions: actions.length };
}
