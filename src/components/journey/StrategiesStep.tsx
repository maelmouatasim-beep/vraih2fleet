/**
 * Étape 3 du parcours — Stratégies : trois stratégies de remplacement
 * chiffrées par LE moteur TCO (année d'acquisition par véhicule,
 * subventions du registre, infra du dépôt), puis stress test (§7) de la
 * stratégie sélectionnée.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@/hooks/use-toast";
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useConfirmedSubsidies } from "@/hooks/useConfirmedSubsidies";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import {
  changementsStrategie,
  construireStrategies,
  estPlanVide,
  strategieMeilleureEconomie,
  type CleStrategie,
  type VehiculeProjet,
} from "@/lib/journey/strategies";
import { formateurCad } from "@/lib/format";
import { setProjectStrategy, type ProjectDTO } from "@/lib/supabase/projects";
import { cn } from "@/lib/utils";
import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import StressTestPanel from "./StressTestPanel";
import { traduireAvertissement } from "@/lib/tco/translations-en";

interface StrategiesStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function StrategiesStep({ projectId, project }: StrategiesStepProps) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language === "en" ? "en" : "fr";
  const { options, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading, modifier } = useProjectVehicles(projectId);
  const { confirmeesParVehicule } = useConfirmedSubsidies(projectId);
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<CleStrategie>("plan_actuel");
  const [applicationOuverte, setApplicationOuverte] = useState(false);
  const [applicationEnCours, setApplicationEnCours] = useState(false);

  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  const vehiculesProjet = useMemo(
    (): VehiculeProjet[] =>
      projectVehicles.map((pv) => ({
        ...pv.vehicles,
        replacement_year: pv.replacement_year,
        target_technology: pv.target_technology,
        subventionsConfirmees: confirmeesParVehicule.get(pv.vehicle_id),
      })),
    [projectVehicles, confirmeesParVehicule],
  );

  const strategies = useMemo(() => {
    if (!options || vehiculesProjet.length === 0) return null;
    return construireStrategies(vehiculesProjet, options);
  }, [options, vehiculesProjet]);

  // C3 : détail des cibles que la stratégie sélectionnée changerait
  const changements = useMemo(() => {
    if (!options || vehiculesProjet.length === 0) return [];
    return changementsStrategie(vehiculesProjet, selection, options);
  }, [options, vehiculesProjet, selection]);

  const uniteDe = useMemo(() => {
    const parId = new Map(projectVehicles.map((pv) => [pv.vehicle_id, pv]));
    return (vehiculeId: string) => parId.get(vehiculeId);
  }, [projectVehicles]);

  const appliquerAuPlan = async () => {
    setApplicationEnCours(true);
    try {
      for (const c of changements) {
        const pv = uniteDe(c.vehiculeId);
        if (!pv) continue;
        await modifier.mutateAsync({ id: pv.id, patch: { target_technology: c.cibleNouvelle } });
      }
      await setProjectStrategy(projectId, selection);
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({ title: t("journey.strategies.apply.done", { count: changements.length }) });
      setApplicationOuverte(false);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setApplicationEnCours(false);
    }
  };

  if (orgLoading || isLoading || (projectVehicles.length > 0 && !strategies)) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (projectVehicles.length === 0 || !strategies) {
    return (
      <Card>
        <CardContent className="text-center py-16 px-6 space-y-3">
          <p className="font-medium">{t("journey.strategies.empty.title")}</p>
          <p className="text-sm text-muted-foreground">{t("journey.strategies.empty.subtitle")}</p>
          <Button asChild>
            <Link to={`/dashboard/projects/${projectId}/flotte`}>
              {t("journey.steps.flotte.title")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const meilleure = strategieMeilleureEconomie(strategies);
  const selectionnee = strategies.find((s) => s.cle === selection) ?? strategies[0];
  const exclusions = strategies[0].exclusions;
  const sansAnnee = strategies[0].sansAnnee;

  return (
    <div className="space-y-4">
      {(exclusions.length > 0 || sansAnnee.length > 0) && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-1">
          {exclusions.length > 0 && (
            <p>{t("journey.strategies.warnings.excluded", { count: exclusions.length })}</p>
          )}
          {sansAnnee.length > 0 && (
            <p>{t("journey.strategies.warnings.noYear", { count: sansAnnee.length })}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {strategies.map((s) => {
          const r = s.resultat;
          const active = s.cle === selection;
          const van = r?.vanDifferentielle ?? 0;
          return (
            <button
              key={s.cle}
              type="button"
              onClick={() => setSelection(s.cle)}
              className={cn(
                "text-left rounded-xl border bg-card p-4 space-y-3 transition-colors",
                active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t(`journey.strategies.options.${s.cle}.title`)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(`journey.strategies.options.${s.cle}.description`)}
                  </p>
                  {project?.selectedStrategy === s.cle && (
                    <Badge className="mt-1.5" variant="default">
                      <ClipboardCheck className="w-3 h-3 mr-1" />
                      {t("journey.strategies.apply.retained")}
                    </Badge>
                  )}
                </div>
                {active && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
              </div>
              {r && estPlanVide(s) ? (
                <p className="text-sm text-muted-foreground">{t("journey.strategies.emptyPlan")}</p>
              ) : r ? (
                <>
                  <p className={cn("text-xl font-bold", van >= 0 ? "text-primary" : "text-destructive")}>
                    {van >= 0
                      ? t("journey.feasibility.savings", { amount: argent.format(van) })
                      : t("journey.feasibility.extraCost", { amount: argent.format(-van) })}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      {t("journey.strategies.metrics.vehicles", {
                        ze: s.nbZeroEmission,
                        total: s.nbVehicules,
                      })}
                    </p>
                    <p>{t("journey.strategies.metrics.co2", { tonnes: r.co2EviteWtwTonnes.toFixed(0) })}</p>
                    <p>
                      {r.paybackActualise.annees != null
                        ? t("journey.feasibility.payback", { years: r.paybackActualise.annees })
                        : t("journey.feasibility.noPayback", {
                            reason: t(
                              `journey.feasibility.paybackNever.${r.paybackActualise.code ?? "surcout_non_resorbe"}`,
                              { horizon: r.horizonAns },
                            ),
                          })}
                    </p>
                    <p>{t("journey.strategies.metrics.infra", { amount: argent.format(s.infraCapex) })}</p>
                    <p>
                      {t("journey.strategies.metrics.subsidies", {
                        amount: argent.format(s.subventionsTotal),
                      })}
                    </p>
                  </div>
                  {s.aucuneElectrificationRentable && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {t("journey.strategies.noProfitable")}
                    </p>
                  )}
                  {s.selection && s.selection.some((g) => g.candidats > 0) && (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {s.selection
                        .filter((g) => g.candidats > 0)
                        .map((g) => (
                          <li key={g.depot ?? ""}>
                            {t("journey.strategies.selectionGarage", {
                              garage: g.depot ?? t("journey.infra.noDepot"),
                              retenus: g.retenus,
                              candidats: g.candidats,
                            })}
                          </li>
                        ))}
                    </ul>
                  )}
                  {s.cle === meilleure && (
                    <Badge variant="secondary">{t("journey.strategies.bestSavings")}</Badge>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("journey.strategies.notComputable")}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* C3 — appliquer la stratégie sélectionnée au plan (project_vehicles) */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="text-sm">
            <p className="font-medium">
              {t("journey.strategies.apply.title", {
                strategy: t(`journey.strategies.options.${selectionnee.cle}.title`),
              })}
            </p>
            <p className="text-muted-foreground">
              {changements.length > 0
                ? t("journey.strategies.apply.pending", { count: changements.length })
                : t("journey.strategies.apply.noChange")}
            </p>
            {project?.selectedStrategy && project.strategyAppliedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("journey.strategies.apply.current", {
                  strategy: t(`journey.strategies.options.${project.selectedStrategy}.title`),
                  date: new Date(project.strategyAppliedAt).toLocaleDateString(i18n.language === "en" ? "en-CA" : "fr-CA"),
                })}
              </p>
            )}
          </div>
          <Button onClick={() => setApplicationOuverte(true)} disabled={!selectionnee.resultat}>
            <ClipboardCheck className="w-4 h-4 mr-2" />
            {t("journey.strategies.apply.button")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("journey.strategies.methodTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>{t("journey.strategies.methodNote1")}</p>
          <p>{t("journey.strategies.methodNote2")}</p>
          {selectionnee.horsHorizon.length > 0 && (
            <p>
              {t("journey.strategies.outOfHorizon", {
                count: selectionnee.horsHorizon.length,
                liste: selectionnee.horsHorizon
                  .map(
                    (h) =>
                      `${projectVehicles.find((pv) => pv.vehicle_id === h.id)?.vehicles.unit_number ?? "?"} (${h.anneeRemplacement})`,
                  )
                  .join(", "),
              })}
            </p>
          )}
          {selectionnee.resultat &&
            (selectionnee.resultat.avertissements.length > 0 ||
              selectionnee.avertissementsSubventions.length > 0) && (
              <ul className="list-disc pl-5 pt-1">
                {[...selectionnee.avertissementsSubventions, ...selectionnee.resultat.avertissements]
                  .slice(0, 8)
                  .map((a, i) => (
                    <li key={i}>{traduireAvertissement(a, langue)}</li>
                  ))}
              </ul>
            )}
        </CardContent>
      </Card>

      {selectionnee.plan && <StressTestPanel plan={selectionnee.plan} />}

      {/* Confirmation avec le DÉTAIL des changements avant écriture */}
      <Dialog open={applicationOuverte} onOpenChange={(o) => !applicationEnCours && setApplicationOuverte(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("journey.strategies.apply.dialogTitle", {
                strategy: t(`journey.strategies.options.${selection}.title`),
              })}
            </DialogTitle>
            <DialogDescription>{t("journey.strategies.apply.dialogSubtitle")}</DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm space-y-2">
            {changements.length === 0 ? (
              <p className="text-muted-foreground">{t("journey.strategies.apply.noChangeDetail")}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {changements.map((c) => {
                  const pv = uniteDe(c.vehiculeId);
                  return (
                    <div key={c.vehiculeId} className="flex items-center justify-between px-3 py-2">
                      <span className="font-medium">{pv?.vehicles.unit_number ?? "?"}</span>
                      <span className="text-muted-foreground">
                        {c.cibleActuelle
                          ? t(`journey.fleet.targets.${c.cibleActuelle}`)
                          : t("journey.strategies.apply.none")}
                        {" → "}
                        <span className="text-foreground font-medium">
                          {t(`journey.fleet.targets.${c.cibleNouvelle}`)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApplicationOuverte(false)} disabled={applicationEnCours}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void appliquerAuPlan()} disabled={applicationEnCours}>
              {applicationEnCours ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("journey.strategies.apply.confirm", { count: changements.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
