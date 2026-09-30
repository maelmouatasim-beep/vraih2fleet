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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/hooks/useAuth";
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { supabase } from "@/integrations/supabase/client";
import {
  etatRemplacement,
  tachesDuPlan,
  type EtatRemplacement,
  type VehiculeSuivi,
} from "@/lib/journey/tracking";
import { formateurCad } from "@/lib/format";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { CheckCircle2, ListChecks, Loader2, Sparkles } from "lucide-react";

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

interface FormulaireRealise {
  ligneId: string; // id project_vehicles
  unite: string;
  date: string;
  vehiculeAcquis: string;
  coutReel: string;
  dejaRealise: boolean;
}

export default function TrackingStep({ projectId, project }: TrackingStepProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { options, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading, modifier } = useProjectVehicles(projectId);
  const [generation, setGeneration] = useState(false);
  const [cleTableau, setCleTableau] = useState(0);
  const [realise, setRealise] = useState<FormulaireRealise | null>(null);

  const anneeCourante = new Date().getFullYear();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  const suivi = useMemo(() => {
    const vehicules: (VehiculeSuivi & { etat: EtatRemplacement; ligneId: string })[] =
      projectVehicles.map((pv) => {
        const v: VehiculeSuivi = {
          ...pv.vehicles,
          replacement_year: pv.replacement_year,
          target_technology: pv.target_technology,
          completed_date: pv.completed_date,
          actual_cost: pv.actual_cost,
          acquired_vehicle: pv.acquired_vehicle,
        };
        return { ...v, etat: etatRemplacement(v, anneeCourante), ligneId: pv.id };
      });
    const compte = (etat: EtatRemplacement) => vehicules.filter((v) => v.etat === etat).length;
    const coutReelTotal = vehicules.reduce((a, v) => a + (v.actual_cost ?? 0), 0);
    return {
      vehicules,
      realises: compte("realise"),
      enRetard: compte("en_retard"),
      cetteAnnee: compte("cette_annee"),
      aVenir: compte("a_venir"),
      coutReelTotal,
    };
  }, [projectVehicles, anneeCourante]);

  const ouvrirRealise = (v: (typeof suivi.vehicules)[number]) => {
    setRealise({
      ligneId: v.ligneId,
      unite: v.unit_number,
      date: v.completed_date ?? new Date().toISOString().slice(0, 10),
      vehiculeAcquis: v.acquired_vehicle ?? "",
      coutReel: v.actual_cost != null ? String(v.actual_cost) : "",
      dejaRealise: !!v.completed_date,
    });
  };

  const enregistrerRealise = async () => {
    if (!realise) return;
    const cout = realise.coutReel.trim()
      ? Number(realise.coutReel.replace(/\s/g, "").replace(",", "."))
      : null;
    if (cout != null && (!Number.isFinite(cout) || cout < 0)) {
      toast({ title: t("journey.tracking.completed.invalidCost"), variant: "destructive" });
      return;
    }
    try {
      await modifier.mutateAsync({
        id: realise.ligneId,
        patch: {
          completed_date: realise.date || null,
          acquired_vehicle: realise.vehiculeAcquis.trim() || null,
          actual_cost: cout,
        },
      });
      toast({ title: t("journey.tracking.completed.saved", { unit: realise.unite }) });
      setRealise(null);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const annulerRealise = async () => {
    if (!realise) return;
    try {
      await modifier.mutateAsync({
        id: realise.ligneId,
        patch: { completed_date: null, acquired_vehicle: null, actual_cost: null },
      });
      toast({ title: t("journey.tracking.completed.cleared", { unit: realise.unite }) });
      setRealise(null);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const genererTaches = async () => {
    if (!options) return;
    setGeneration(true);
    try {
      const proposees = tachesDuPlan(
        suivi.vehicules,
        { ...options, anneeReference: anneeCourante },
        {
          remplacement: ({ unite, techno }) =>
            t("journey.tracking.tasks.replaceTitle", { unit: unite, techno }),
          subvention: ({ programme, unite }) =>
            t("journey.tracking.tasks.submitTitle", { program: programme, unit: unite }),
        },
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
          created_by: user?.id,
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
                  <TableHead>{t("journey.tracking.columns.completed")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suivi.vehicules.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium whitespace-nowrap">{v.unit_number}</TableCell>
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
                    <TableCell className="text-xs">
                      {v.completed_date ? (
                        <div className="space-y-0.5">
                          <p>{v.completed_date}</p>
                          {v.acquired_vehicle && (
                            <p className="text-muted-foreground">{v.acquired_vehicle}</p>
                          )}
                          {v.actual_cost != null && (
                            <p className="text-muted-foreground">{argent.format(v.actual_cost)}</p>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => ouvrirRealise(v)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {v.completed_date
                          ? t("journey.tracking.completed.editButton")
                          : t("journey.tracking.completed.markButton")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {suivi.coutReelTotal > 0 && (
          <CardContent className="border-t border-border py-3 text-sm text-muted-foreground">
            {t("journey.tracking.completed.totalActual", {
              amount: argent.format(suivi.coutReelTotal),
            })}
          </CardContent>
        )}
      </Card>

      {/* C4 — marquer un remplacement réalisé (date, véhicule acquis, coût réel) */}
      <Dialog open={realise !== null} onOpenChange={(o) => !o && setRealise(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("journey.tracking.completed.dialogTitle", { unit: realise?.unite ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("journey.tracking.completed.dialogSubtitle")}</DialogDescription>
          </DialogHeader>
          {realise && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tr-date">{t("journey.tracking.completed.date")} *</Label>
                <Input
                  id="tr-date"
                  type="date"
                  value={realise.date}
                  onChange={(e) => setRealise({ ...realise, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tr-veh">{t("journey.tracking.completed.acquiredVehicle")}</Label>
                <Input
                  id="tr-veh"
                  placeholder={t("journey.tracking.completed.acquiredVehicleHint")}
                  value={realise.vehiculeAcquis}
                  onChange={(e) => setRealise({ ...realise, vehiculeAcquis: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tr-cout">{t("journey.tracking.completed.actualCost")}</Label>
                <Input
                  id="tr-cout"
                  inputMode="decimal"
                  placeholder={t("journey.tracking.completed.actualCostHint")}
                  value={realise.coutReel}
                  onChange={(e) => setRealise({ ...realise, coutReel: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {realise?.dejaRealise && (
              <Button
                variant="ghost"
                className="text-destructive mr-auto"
                onClick={() => void annulerRealise()}
                disabled={modifier.isPending}
              >
                {t("journey.tracking.completed.clear")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setRealise(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => void enregistrerRealise()} disabled={modifier.isPending || !realise?.date}>
              {modifier.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("journey.tracking.completed.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
