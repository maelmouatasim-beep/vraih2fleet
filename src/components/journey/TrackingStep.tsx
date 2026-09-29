/**
 * Étape 7 du parcours — Suivi : réalisé vs prévu (état de chaque
 * véhicule du plan) et tâches intégrées (kanban/liste réutilisé, tâches
 * liées au véhicule/année/subvention, génération idempotente depuis les
 * échéances du plan).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskBoard } from "@/components/tasks";
import { toast } from "@/hooks/use-toast";
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { supabase } from "@/integrations/supabase/client";
import {
  etatRemplacement,
  tachesDuPlan,
  type EtatRemplacement,
  type VehiculeSuivi,
} from "@/lib/journey/tracking";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { ListChecks, Loader2, Sparkles } from "lucide-react";

interface TrackingStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

const BADGES: Record<EtatRemplacement, "default" | "secondary" | "destructive" | "outline"> = {
  realise: "default",
  cette_annee: "secondary",
  en_retard: "destructive",
  a_venir: "outline",
  sans_plan: "outline",
};

export default function TrackingStep({ projectId, project }: TrackingStepProps) {
  const { t } = useTranslation();
  const { options, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);
  const [generation, setGeneration] = useState(false);
  const [cleTableau, setCleTableau] = useState(0);

  const anneeCourante = new Date().getFullYear();

  const suivi = useMemo(() => {
    const vehicules: (VehiculeSuivi & { etat: EtatRemplacement })[] = projectVehicles.map((pv) => {
      const v: VehiculeSuivi = {
        ...pv.vehicles,
        replacement_year: pv.replacement_year,
        target_technology: pv.target_technology,
      };
      return { ...v, etat: etatRemplacement(v, anneeCourante) };
    });
    const compte = (etat: EtatRemplacement) => vehicules.filter((v) => v.etat === etat).length;
    return {
      vehicules,
      realises: compte("realise"),
      enRetard: compte("en_retard"),
      cetteAnnee: compte("cette_annee"),
      aVenir: compte("a_venir"),
    };
  }, [projectVehicles, anneeCourante]);

  const genererTaches = async () => {
    if (!options) return;
    setGeneration(true);
    try {
      const proposees = tachesDuPlan(
        suivi.vehicules,
        { ...options, anneeReference: anneeCourante },
      );
      const { data: existantes, error: errLecture } = await supabase
        .from("tasks")
        .select("auto_key")
        .eq("project_id", projectId)
        .not("auto_key", "is", null);
      if (errLecture) throw errLecture;
      const deja = new Set((existantes ?? []).map((x) => x.auto_key));
      const aCreer = proposees.filter((p) => !deja.has(p.auto_key));
      if (aCreer.length === 0) {
        toast({ title: t("journey.tracking.tasks.upToDate") });
        return;
      }
      const { error } = await supabase.from("tasks").insert(
        aCreer.map((p) => ({
          project_id: projectId,
          title: p.title,
          due_date: p.due_date,
          status: "todo",
          vehicle_id: p.vehicle_id,
          plan_year: p.plan_year,
          subsidy_program: p.subsidy_program,
          auto_key: p.auto_key,
        })),
      );
      if (error) throw error;
      toast({ title: t("journey.tracking.tasks.generated", { count: aCreer.length }) });
      setCleTableau((k) => k + 1);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setGeneration(false);
    }
  };

  if (orgLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            ["realise", suivi.realises],
            ["en_retard", suivi.enRetard],
            ["cette_annee", suivi.cetteAnnee],
            ["a_venir", suivi.aVenir],
          ] as const
        ).map(([cle, valeur]) => (
          <Card key={cle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                {t(`journey.tracking.states.${cle}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{valeur}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{t("journey.tracking.tableTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t("journey.tracking.tableSubtitle")}</p>
          </div>
          <Button onClick={() => void genererTaches()} disabled={generation || suivi.vehicules.length === 0}>
            {generation ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {t("journey.tracking.tasks.generate")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {suivi.vehicules.length === 0 ? (
            <div className="text-center py-12 px-6 space-y-3">
              <p className="text-sm text-muted-foreground">{t("journey.tracking.empty")}</p>
              <Button asChild variant="outline">
                <Link to={`/dashboard/projects/${projectId}/flotte`}>
                  {t("journey.steps.flotte.title")}
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fleet.columns.unit")}</TableHead>
                  <TableHead>{t("fleet.columns.category")}</TableHead>
                  <TableHead>{t("journey.fleet.columns.replacementYear")}</TableHead>
                  <TableHead>{t("journey.fleet.columns.target")}</TableHead>
                  <TableHead>{t("fleet.columns.fuel")}</TableHead>
                  <TableHead>{t("journey.tracking.columns.state")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suivi.vehicules.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.unit_number}</TableCell>
                    <TableCell>{t(`fleet.categories.${v.category}`)}</TableCell>
                    <TableCell>{v.replacement_year ?? "—"}</TableCell>
                    <TableCell>
                      {v.target_technology
                        ? t(`journey.fleet.targets.${v.target_technology}`)
                        : "—"}
                    </TableCell>
                    <TableCell>{t(`fleet.fuels.${v.fuel_type}`)}</TableCell>
                    <TableCell>
                      <Badge variant={BADGES[v.etat]}>{t(`journey.tracking.states.${v.etat}`)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListChecks className="w-5 h-5" /> {t("journey.tracking.tasks.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("journey.tracking.tasks.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <TaskBoard key={cleTableau} projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
}
