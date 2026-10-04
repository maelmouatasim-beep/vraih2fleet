/**
 * Étape 3 du parcours — Stratégies : trois stratégies de remplacement
 * chiffrées par LE moteur TCO (année d'acquisition par véhicule,
 * subventions du registre, infra du dépôt), puis stress test (§7) de la
 * stratégie sélectionnée.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  type StrategieConstruite,
  type VehiculeProjet,
} from "@/lib/journey/strategies";
import {
  anneesPrevuesDe,
  changementsOptimises,
  contraintesParDefaut,
  lireAssignation,
  lireContraintes,
  BUDGET_OPTIMISEUR_MS,
  optimiserCalendrierProgressif,
  type ContraintesOptimiseur,
  type ResultatOptimisation,
} from "@/lib/journey/optimizer";
import { changementsVehicules } from "@/lib/journey/changeLog";
import { cleGarage } from "@/lib/journey/infrastructure";
import { journaliser } from "@/lib/supabase/changeLog";
import { useGarages } from "@/hooks/useGarages";
import { OptimizedStrategyDetail, OptimizerConstraintsDialog, type GarageOptimiseur } from "./OptimizerPanel";
import { formateurCad, formateurNombre } from "@/lib/format";
import {
  saveOptimizerConstraints,
  setOptimizedStrategy,
  setProjectStrategy,
  type ProjectDTO,
} from "@/lib/supabase/projects";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, ClipboardCheck, Loader2, SlidersHorizontal } from "lucide-react";
import StressTestPanel from "./StressTestPanel";
import VanDecompositionCard from "./VanDecompositionCard";
import GaragesPresumesAlert from "./GaragesPresumesAlert";
import { investissementCompare } from "@/lib/journey/synthese";
import { traduireAvertissement } from "@/lib/tco/translations-en";
import { vehiculeProjetDepuis } from "@/lib/journey/vehiculeProjet";
import { LoadingState } from "@/components/layout/States";

interface StrategiesStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function StrategiesStep({ projectId, project }: StrategiesStepProps) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language === "en" ? "en" : "fr";
  const { options, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading, appliquerLot } = useProjectVehicles(projectId);
  const { confirmeesParVehicule } = useConfirmedSubsidies(projectId);
  const { garages: garagesOrg } = useGarages(project?.organizationId);
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<CleStrategie>("plan_actuel");
  const [applicationOuverte, setApplicationOuverte] = useState(false);
  const [applicationEnCours, setApplicationEnCours] = useState(false);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [optimisation, setOptimisation] = useState<ResultatOptimisation | null>(null);

  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  const vehiculesProjet = useMemo(
    (): VehiculeProjet[] =>
      projectVehicles.map((pv) => vehiculeProjetDepuis(pv, confirmeesParVehicule.get(pv.vehicle_id))),
    [projectVehicles, confirmeesParVehicule],
  );

  const strategies = useMemo(() => {
    if (!options || vehiculesProjet.length === 0) return null;
    return construireStrategies(vehiculesProjet, options);
  }, [options, vehiculesProjet]);

  // Phase 5.1 — optimiseur : contraintes enregistrées sur le projet,
  // assignation déjà appliquée (fenêtre de calendrier d'origine).
  const contraintesSauvees = useMemo(() => lireContraintes(project?.optimizerConstraints), [project?.optimizerConstraints]);
  const assignation = useMemo(() => lireAssignation(project?.optimizedAssignment), [project?.optimizedAssignment]);

  // Optimiseur borné dans le temps (5 s), progression affichée, JAMAIS
  // relancé automatiquement (ajustement C de l'audit) : avec des
  // contraintes enregistrées, la carte propose « Lancer l'optimiseur ».
  const [progression, setProgression] = useState(0);
  const lancerOptimisation = async (contraintes: ContraintesOptimiseur) => {
    if (!options || vehiculesProjet.length === 0) return;
    setCalculEnCours(true);
    setProgression(0);
    try {
      setOptimisation(
        await optimiserCalendrierProgressif(
          { vehicules: vehiculesProjet, options, contraintes, anneesPrevues: anneesPrevuesDe(assignation) },
          setProgression,
        ),
      );
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setCalculEnCours(false);
    }
  };

  const soumettreContraintes = async (c: ContraintesOptimiseur) => {
    setFormulaireOuvert(false);
    setSelection("optimisee");
    try {
      await saveOptimizerConstraints(projectId, c as unknown as Json);
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
    void lancerOptimisation(c);
  };

  const uniteDe = useMemo(() => {
    const parId = new Map(projectVehicles.map((pv) => [pv.vehicle_id, pv]));
    return (vehiculeId: string) => parId.get(vehiculeId);
  }, [projectVehicles]);
  const nomUnite = (id: string) => uniteDe(id)?.vehicles.unit_number ?? "?";

  // Aperçu avant → après de l'application au plan (année ET cible pour l'optimisée).
  const changements = useMemo(() => {
    if (!options || vehiculesProjet.length === 0) return [];
    if (selection === "optimisee") {
      return optimisation ? changementsOptimises(vehiculesProjet, optimisation.choix) : [];
    }
    return changementsStrategie(vehiculesProjet, selection, options).map((c) => ({
      vehiculeId: c.vehiculeId,
      anneeActuelle: null as number | null,
      anneeNouvelle: null as number | null,
      cibleActuelle: c.cibleActuelle,
      cibleNouvelle: c.cibleNouvelle,
    }));
  }, [options, vehiculesProjet, selection, optimisation]);

  const appliquerAuPlan = async () => {
    setApplicationEnCours(true);
    try {
      // UNE écriture atomique (point 6 de l'audit) : tout ou rien.
      await appliquerLot.mutateAsync(
        changements.flatMap((c) => {
          const pv = uniteDe(c.vehiculeId);
          if (!pv) return [];
          return [{ id: pv.id, target_technology: c.cibleNouvelle, ...(c.anneeNouvelle != null ? { replacement_year: c.anneeNouvelle } : {}) }];
        }),
      );
      if (selection === "optimisee" && optimisation) {
        await setOptimizedStrategy(projectId, {
          calculeLe: new Date().toISOString(),
          vehicules: optimisation.choix,
        } as unknown as Json);
      } else {
        await setProjectStrategy(projectId, selection);
      }
      // Journal (qui, quand, quoi) : aperçu avant → après, sans donnée personnelle.
      if (project?.organizationId) {
        await journaliser({
          organizationId: project.organizationId,
          projectId,
          source: selection === "optimisee" ? "optimiseur" : "strategie",
          action: `appliquer_strategie:${selection}`,
          resume: t("journey.strategies.apply.logSummary", {
            strategy: t(`journey.strategies.options.${selection}.title`),
            count: changements.length,
          }),
          changements: changementsVehicules(
            changements.map((c) => ({
              unite: nomUnite(c.vehiculeId),
              anneeAvant: c.anneeActuelle,
              anneeApres: c.anneeNouvelle ?? c.anneeActuelle,
              cibleAvant: c.cibleActuelle,
              cibleApres: c.cibleNouvelle,
            })),
          ),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["change-log", projectId] });
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
        <LoadingState nombre={6} />
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

  const toutes: StrategieConstruite[] = optimisation?.strategie ? [...strategies, optimisation.strategie] : strategies;
  const meilleure = strategieMeilleureEconomie(toutes);
  const selectionnee =
    selection === "optimisee" ? optimisation?.strategie ?? null : strategies.find((s) => s.cle === selection) ?? strategies[0];
  const exclusions = strategies[0].exclusions;
  const sansAnnee = strategies[0].sansAnnee;

  const garagesOptimiseur: GarageOptimiseur[] = (() => {
    const parCle = new Map<string, GarageOptimiseur>();
    for (const v of vehiculesProjet) {
      const cle = cleGarage(v.depot ?? null);
      if (parCle.has(cle)) continue;
      const g = garagesOrg.find((x) => cleGarage(x.name) === cle);
      parCle.set(cle, {
        cle,
        nom: v.depot?.trim() || null,
        placesConnues: g?.parking_spots ?? null,
        kwDisponibles: g?.available_power_kw ?? null,
      });
    }
    return [...parCle.values()].sort((a, b) => (a.nom ?? "￿").localeCompare(b.nom ?? "￿", "fr"));
  })();
  const categories = [...new Set(vehiculesProjet.map((v) => v.category))].sort();

  const carte = (s: StrategieConstruite) => {
    const r = s.resultat;
    const van = r?.vanDifferentielle ?? 0;
    return r && estPlanVide(s) ? (
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
          <p>
            {t("journey.strategies.metrics.co2", {
              ttw: formateurNombre(i18n.language).format(r.co2EviteTtwTonnes),
              wtw: formateurNombre(i18n.language).format(r.co2EviteWtwTonnes),
            })}
          </p>
          <p>
            {r.paybackActualise.annees != null
              ? t("journey.feasibility.payback", { years: r.paybackActualise.annees })
              : r.paybackActualise.code === "aucun_ecart"
                ? t("journey.feasibility.paybackNotApplicable", { reason: t("journey.feasibility.paybackNever.aucun_ecart") })
                : t("journey.feasibility.noPayback", {
                  reason: t(
                    `journey.feasibility.paybackNever.${r.paybackActualise.code ?? "surcout_non_resorbe"}`,
                    { horizon: r.horizonAns },
                  ),
                })}
          </p>
          {(() => {
            const inv = investissementCompare(r);
            return (
              <p data-testid="strategy-investment">
                {t("journey.strategies.metrics.investment", {
                  amount: argent.format(inv.brut),
                  sq: argent.format(inv.statuQuo),
                  diff: (inv.surcout >= 0 ? "+" : "") + argent.format(inv.surcout),
                })}
              </p>
            );
          })()}
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
          <ul className="text-xs text-muted-foreground space-y-1.5" data-testid="selection-garages">
            {s.selection
              .filter((g) => g.candidats > 0)
              .map((g) => {
                const unites = (raison: "borne" | "raccordement") =>
                  g.exclus.filter((e) => e.raison === raison).map((e) => e.unit_number ?? e.id);
                const borne = unites("borne");
                const raccordement = unites("raccordement");
                return (
                  <li key={g.depot ?? ""} className="space-y-0.5" data-testid="selection-garage">
                    <p className="font-medium text-foreground">
                      {t("journey.strategies.selectionGarage", {
                        garage: g.depot ?? t("journey.infra.noDepot"),
                        retenus: g.retenus,
                        candidats: g.candidats,
                      })}
                    </p>
                    {g.infra && (
                      <p>
                        {t("journey.strategies.selectionInfra", {
                          bornes: argent.format(g.infra.capexBornes),
                          kw: g.infra.kwDemandes,
                          dispo: g.infra.kwDisponibles,
                          source: t(`journey.strategies.selectionSource.${g.infra.kwDisponiblesSource}`),
                          raccordement:
                            g.infra.palier === 0 && g.infra.coutRaccordement === 0
                              ? t("journey.strategies.selectionRaccordement0")
                              : t("journey.strategies.selectionRaccordement", {
                                  palier: g.infra.palier,
                                  cout: argent.format(g.infra.coutRaccordement),
                                }),
                        })}
                      </p>
                    )}
                    {borne.length > 0 && (
                      <p>{t("journey.strategies.selectionExclusBorne", { count: borne.length, unites: borne.join(", ") })}</p>
                    )}
                    {raccordement.length > 0 && (
                      <p>
                        {t("journey.strategies.selectionExclusRaccordement", {
                          count: raccordement.length,
                          unites: raccordement.join(", "),
                        })}
                      </p>
                    )}
                  </li>
                );
              })}
            <li className="italic">{t("journey.strategies.selectionMethode")}</li>
          </ul>
        )}
        {s.cle === meilleure && <Badge variant="secondary">{t("journey.strategies.bestSavings")}</Badge>}
      </>
    ) : (
      <p className="text-sm text-muted-foreground">{t("journey.strategies.notComputable")}</p>
    );
  };

  const entete = (cle: CleStrategie, active: boolean) => (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-semibold">{t(`journey.strategies.options.${cle}.title`)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t(`journey.strategies.options.${cle}.description`)}</p>
        {project?.selectedStrategy === cle && (
          <Badge className="mt-1.5" variant="default">
            <ClipboardCheck className="w-3 h-3 mr-1" />
            {t("journey.strategies.apply.retained")}
          </Badge>
        )}
      </div>
      {active && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
    </div>
  );

  const deplaces = optimisation
    ? optimisation.decisions.filter((d) => d.annee !== d.anneePrevue || d.techno !== d.technoPrevue).length
    : 0;

  return (
    <div className="space-y-4">
      <GaragesPresumesAlert organizationId={project?.organizationId} depots={projectVehicles.map((pv) => pv.vehicles?.depot)} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
        {strategies.map((s) => {
          const active = s.cle === selection;
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
              {entete(s.cle, active)}
              {carte(s)}
            </button>
          );
        })}

        {/* 4e stratégie : Optimisée (Phase 5.1) */}
        <div
          role="button"
          tabIndex={0}
          data-testid="strategy-optimisee"
          onClick={() => optimisation && setSelection("optimisee")}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && optimisation) setSelection("optimisee");
          }}
          className={cn(
            "text-left rounded-xl border bg-card p-4 space-y-3 transition-colors",
            selection === "optimisee" ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
          )}
        >
          {entete("optimisee", selection === "optimisee")}
          {calculEnCours ? (
            <div className="space-y-2" data-testid="optimizer-progress">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("journey.optimizer.runningBounded", { seconds: BUDGET_OPTIMISEUR_MS / 1000 })}
              </p>
              <Progress value={Math.round(progression * 100)} aria-label={t("journey.optimizer.progress")} />
            </div>
          ) : optimisation?.strategie ? (
            <>
              {carte(optimisation.strategie)}
              <p className={cn("text-xs font-medium", optimisation.realisable ? "text-primary" : "text-amber-700 dark:text-amber-400")}>
                {optimisation.realisable
                  ? t("journey.optimizer.cardFeasible", { count: deplaces })
                  : t("journey.optimizer.cardInfeasible", { count: optimisation.violations.length })}
              </p>
              {optimisation.approche && (
                <p className="text-xs text-muted-foreground" data-testid="optimizer-approximate">
                  {t("journey.optimizer.approximate", { seconds: BUDGET_OPTIMISEUR_MS / 1000 })}
                </p>
              )}
            </>
          ) : contraintesSauvees ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("journey.optimizer.savedNotRun")}</p>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  void lancerOptimisation(contraintesSauvees);
                }}
                data-testid="optimizer-run"
              >
                {t("journey.optimizer.run")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("journey.optimizer.cardEmpty")}</p>
          )}
          <Button
            size="sm"
            variant={optimisation ? "outline" : "default"}
            onClick={(e) => {
              e.stopPropagation();
              setFormulaireOuvert(true);
            }}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            {optimisation ? t("journey.optimizer.editConstraints") : t("journey.optimizer.defineConstraints")}
          </Button>
        </div>
      </div>

      {/* C3 — appliquer la stratégie sélectionnée au plan (project_vehicles) */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="text-sm">
            <p className="font-medium">
              {t("journey.strategies.apply.title", {
                strategy: t(`journey.strategies.options.${selection}.title`),
              })}
            </p>
            <p className="text-muted-foreground">
              {changements.length > 0
                ? t(selection === "optimisee" ? "journey.optimizer.applyPending" : "journey.strategies.apply.pending", {
                    count: changements.length,
                  })
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
          <Button onClick={() => setApplicationOuverte(true)} disabled={!selectionnee?.resultat}>
            <ClipboardCheck className="w-4 h-4 mr-2" />
            {t("journey.strategies.apply.button")}
          </Button>
        </CardContent>
      </Card>

      {selection === "optimisee" && optimisation && (
        <OptimizedStrategyDetail resultat={optimisation} argent={argent} uniteDe={nomUnite} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("journey.strategies.methodTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>{t("journey.strategies.methodNote1")}</p>
          <p>{t("journey.strategies.methodNote2")}</p>
          {selectionnee && selectionnee.horsHorizon.length > 0 && (
            <p>
              {t("journey.strategies.outOfHorizon", {
                count: selectionnee.horsHorizon.length,
                liste: selectionnee.horsHorizon
                  .map((h) => `${nomUnite(h.id)} (${h.anneeRemplacement})`)
                  .join(", "),
              })}
            </p>
          )}
          {selectionnee?.resultat &&
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

      {selectionnee?.resultat && <VanDecompositionCard resultat={selectionnee.resultat} />}
      {selectionnee?.plan && <StressTestPanel plan={selectionnee.plan} />}

      <OptimizerConstraintsDialog
        open={formulaireOuvert}
        onOpenChange={setFormulaireOuvert}
        initiales={optimisation?.contraintes ?? contraintesSauvees ?? contraintesParDefaut()}
        vehicules={vehiculesProjet.map((v) => ({ id: v.id, unite: v.unit_number ?? v.id, category: v.category }))}
        garages={garagesOptimiseur}
        categories={categories}
        onSubmit={(c) => void soumettreContraintes(c)}
      />

      {/* Confirmation avec le DÉTAIL des changements avant écriture */}
      <Dialog open={applicationOuverte} onOpenChange={(o) => !applicationEnCours && setApplicationOuverte(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("journey.strategies.apply.dialogTitle", {
                strategy: t(`journey.strategies.options.${selection}.title`),
              })}
            </DialogTitle>
            <DialogDescription>
              {selection === "optimisee"
                ? t("journey.optimizer.applySubtitle")
                : t("journey.strategies.apply.dialogSubtitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm space-y-2">
            {changements.length === 0 ? (
              <p className="text-muted-foreground">{t("journey.strategies.apply.noChangeDetail")}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border" data-testid="apply-preview">
                {changements.map((c) => (
                  <div key={c.vehiculeId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-medium">{nomUnite(c.vehiculeId)}</span>
                    <span className="text-muted-foreground text-right">
                      {c.anneeNouvelle != null && c.anneeNouvelle !== c.anneeActuelle && (
                        <>
                          {c.anneeActuelle ?? t("journey.strategies.apply.none")}
                          {" → "}
                          <span className="text-foreground font-medium">{c.anneeNouvelle}</span>
                          {c.cibleActuelle !== c.cibleNouvelle && " · "}
                        </>
                      )}
                      {c.cibleActuelle !== c.cibleNouvelle && (
                        <>
                          {c.cibleActuelle ? t(`journey.fleet.targets.${c.cibleActuelle}`) : t("journey.strategies.apply.none")}
                          {" → "}
                          <span className="text-foreground font-medium">{t(`journey.fleet.targets.${c.cibleNouvelle}`)}</span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("journey.strategies.apply.logged")}</p>
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
