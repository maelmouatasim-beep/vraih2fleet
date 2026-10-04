/**
 * Étape 2 du parcours — Faisabilité : verdict par véhicule (BEV et FCEV)
 * avec la raison chiffrée par le moteur TCO (économie actualisée vs
 * diesel neuf, payback, CO2 évité). Calcul local et pur (src/lib/journey/
 * feasibility.ts) sur les véhicules sélectionnés à l'étape Flotte.
 */
import { useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
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
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import EnergyClientDataCard from "@/components/organization/EnergyClientDataCard";
import {
  evaluerFaisabiliteVehicule,
  recommandationCible,
  type EvaluationTechno,
  type FaisabiliteVehicule,
} from "@/lib/journey/feasibility";
import { formateurCad, formateurNombre } from "@/lib/format";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { vehiculeProjetDepuis } from "@/lib/journey/vehiculeProjet";
import { StatusBadge, LoadingState } from "@/components/layout/States";
import { ton, TON_VERDICT } from "@/components/layout/tons";
import { StatCard, StatGrid } from "@/components/layout/StatCard";

interface FeasibilityStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function FeasibilityStep({ projectId, project }: FeasibilityStepProps) {
  const { t, i18n } = useTranslation();
  const { options, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading, appliquerLot } = useProjectVehicles(projectId);
  const [application, setApplication] = useState(false);

  const evaluations = useMemo(() => {
    if (!options) return null;
    const parVehicule = new Map<string, FaisabiliteVehicule>();
    for (const pv of projectVehicles) {
      // MÊME année d'acquisition que le Plan (revue A5).
      parVehicule.set(
        pv.vehicle_id,
        evaluerFaisabiliteVehicule(vehiculeProjetDepuis(pv), options),
      );
    }
    return parVehicule;
  }, [options, projectVehicles]);

  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  // 3.3 — véhicules sans technologie cible : recommandation applicable
  const recommandations = useMemo(() => {
    const m = new Map<string, "bev" | "fcev" | "diesel">();
    for (const pv of projectVehicles) {
      if (pv.target_technology != null) continue;
      const f = evaluations?.get(pv.vehicle_id);
      const r = f ? recommandationCible(f) : null;
      if (r) m.set(pv.id, r);
    }
    return m;
  }, [projectVehicles, evaluations]);

  const appliquer = async (entrees: [string, "bev" | "fcev" | "diesel"][]) => {
    setApplication(true);
    try {
      await appliquerLot.mutateAsync(entrees.map(([id, cible]) => ({ id, target_technology: cible })));
      toast({ title: t("journey.feasibility.recommend.done", { count: entrees.length }) });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setApplication(false);
    }
  };

  const stats = useMemo(() => {
    let favorables = 0;
    let conditionnels = 0;
    let defavorables = 0;
    let nonEvaluables = 0;
    for (const pv of projectVehicles) {
      const f = evaluations?.get(pv.vehicle_id);
      const bev = f?.evaluations?.[0];
      if (!bev) nonEvaluables += 1;
      else if (bev.verdict === "favorable") favorables += 1;
      else if (bev.verdict === "conditionnel") conditionnels += 1;
      else defavorables += 1;
    }
    return { favorables, conditionnels, defavorables, nonEvaluables };
  }, [projectVehicles, evaluations]);

  if (orgLoading || isLoading || !evaluations) {
    return (
      <Card>
        <LoadingState nombre={6} />
      </Card>
    );
  }

  if (projectVehicles.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-16 px-6 space-y-3">
          <p className="font-medium">{t("journey.feasibility.empty.title")}</p>
          <p className="text-sm text-muted-foreground">{t("journey.feasibility.empty.subtitle")}</p>
          <Button asChild>
            <Link to={`/dashboard/projects/${projectId}/flotte`}>
              {t("journey.steps.flotte.title")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const celluleCible = (pv: (typeof projectVehicles)[number]) => {
    if (pv.target_technology) {
      return <TableCell className="align-top text-sm">{t(`journey.fleet.targets.${pv.target_technology}`)}</TableCell>;
    }
    const r = recommandations.get(pv.id);
    return (
      <TableCell className="align-top text-sm">
        {r ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("journey.feasibility.recommend.label")}</p>
            <p className="font-medium">{t(`journey.fleet.targets.${r}`)}</p>
            <Button size="sm" variant="outline" disabled={application} onClick={() => void appliquer([[pv.id, r]])}>
              {t("journey.feasibility.recommend.apply")}
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    );
  };

  const verdictBadge = (e: EvaluationTechno | undefined) => {
    const verdict = e?.verdict ?? "non_evaluable";
    return <StatusBadge ton={ton(TON_VERDICT, verdict)}>{t(`journey.feasibility.verdicts.${verdict}`)}</StatusBadge>;
  };

  const detailTechno = (e: EvaluationTechno | undefined) => {
    if (!e) return <p className="text-xs text-muted-foreground">{t("journey.feasibility.unknownCategory")}</p>;
    const economie = e.economieActualisee;
    return (
      <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
        <p className={economie > 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
          {economie > 0
            ? t("journey.feasibility.savings", { amount: argent.format(economie) })
            : t("journey.feasibility.extraCost", { amount: argent.format(-economie) })}
        </p>
        <p>
          {e.paybackActualiseAns != null
            ? t("journey.feasibility.payback", { years: e.paybackActualiseAns })
            : t("journey.feasibility.noPayback", {
                reason: t(`journey.feasibility.paybackNever.${e.paybackJamaisCode ?? "surcout_non_resorbe"}`, {
                  horizon: options?.horizonAns,
                }),
              })}
          {" · "}
          {t("journey.feasibility.co2Avoided", {
            ttw: e.co2EviteTtwTonnes.toFixed(1),
            wtw: e.co2EviteWtwTonnes.toFixed(1),
          })}
        </p>
        {e.subventions.length > 0 && (
          <p>
            {t("journey.feasibility.subsidies", {
              amount: argent.format(e.subventions.reduce((a, s) => a + s.montant, 0)),
            })}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <EnergyClientDataCard projectId={projectId} />
      <StatGrid>
        {(
          [
            ["favorable", stats.favorables],
            ["conditional", stats.conditionnels],
            ["unfavorable", stats.defavorables],
            ["notAssessable", stats.nonEvaluables],
          ] as const
        ).map(([cle, valeur]) => (
          <StatCard key={cle} libelle={t(`journey.feasibility.stats.${cle}`)} valeur={valeur} />
        ))}
      </StatGrid>

      {recommandations.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <p>{t("journey.feasibility.recommend.banner", { count: recommandations.size })}</p>
          <Button size="sm" disabled={application} onClick={() => void appliquer([...recommandations.entries()])}>
            {t("journey.feasibility.recommend.applyAll", { count: recommandations.size })}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("journey.feasibility.tableTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("journey.feasibility.methodNote", {
              horizon: project?.defaultAnalysisHorizonYears ?? 10,
            })}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fleet.columns.unit")}</TableHead>
                <TableHead>{t("fleet.columns.vehicle")}</TableHead>
                <TableHead className="text-right">{t("fleet.columns.annualKm")}</TableHead>
                <TableHead className="min-w-[13rem]">{t("journey.feasibility.columns.bev")}</TableHead>
                <TableHead className="min-w-[13rem]">{t("journey.feasibility.columns.fcev")}</TableHead>
                <TableHead className="min-w-[10rem]">{t("journey.feasibility.columns.notes")}</TableHead>
                <TableHead>{t("journey.feasibility.columns.target")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectVehicles.map((pv) => {
                const f = evaluations.get(pv.vehicle_id);
                if (f?.horsHorizon) {
                  return (
                    <TableRow key={pv.id}>
                      <TableCell className="font-medium whitespace-nowrap">{pv.vehicles.unit_number}</TableCell>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        {t("journey.feasibility.outOfHorizon", {
                          annee: f.horsHorizon.anneeRemplacement,
                          horizon: f.horsHorizon.horizonAns,
                        })}
                      </TableCell>
                      {celluleCible(pv)}
                    </TableRow>
                  );
                }
                if (f?.aReporter) {
                  return (
                    <TableRow key={pv.id}>
                      <TableCell className="font-medium whitespace-nowrap">{pv.vehicles.unit_number}</TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground">{t(`fleet.categories.${pv.vehicles.category}`)}</p>
                      </TableCell>
                      <TableCell colSpan={4} className="text-sm">
                        <Badge variant="outline" className="mr-2">
                          {t("journey.feasibility.postpone.badge")}
                        </Badge>
                        <span className="text-muted-foreground">{t(`journey.feasibility.postpone.${f.aReporter}`)}</span>
                      </TableCell>
                      {celluleCible(pv)}
                    </TableRow>
                  );
                }
                const [bev, fcev] = f?.evaluations ?? [undefined, undefined];
                const reserves = new Set([...(bev?.reserves ?? []), ...(fcev?.reserves ?? [])]);
                return (
                  <TableRow key={pv.id}>
                    <TableCell className="font-medium whitespace-nowrap">{pv.vehicles.unit_number}</TableCell>
                    <TableCell>
                      <p>
                        {[pv.vehicles.make, pv.vehicles.model, pv.vehicles.model_year]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`fleet.categories.${pv.vehicles.category}`)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      {f?.kmParAnRetenu != null ? formateurNombre(i18n.language).format(f.kmParAnRetenu) : "—"}
                      {f?.donneesEstimees.includes("km") && (
                        <p className="text-xs text-muted-foreground">{t("fleet.source.estimation")}</p>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {verdictBadge(bev)}
                      {detailTechno(bev)}
                      {f?.hiver && (
                        <p
                          className={cn(
                            "text-xs mt-1",
                            f.hiver.verdict === "tient"
                              ? "text-primary"
                              : f.hiver.verdict === "recharge_journee"
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-destructive",
                          )}
                        >
                          {t(`journey.feasibility.winter.${f.hiver.verdict}`, {
                            autonomie: f.hiver.autonomieHiverKm,
                            nominale: f.hiver.autonomieNominaleKm,
                            km: f.hiver.kmJour,
                            nuit: f.hiver.energieNuitKwh,
                            jour: f.hiver.energieJourKwh,
                            journee: f.hiver.energieJourneeKwh,
                            fenetre: f.hiver.fenetreH,
                            kw: f.hiver.puissanceBorneKw,
                          })}
                          {f.hiver.kmJourSource === "estime" && ` ${t("journey.feasibility.winter.kmEstimated")}`}
                          {f.hiver.fenetreSource === "presumee" && ` ${t("journey.feasibility.winter.windowPresumed")}`}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {verdictBadge(fcev)}
                      {detailTechno(fcev)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {[...reserves].map((r) => (
                          <Badge key={r} variant="outline">
                            {t(`journey.feasibility.reserves.${r}`)}
                          </Badge>
                        ))}
                        {f?.donneesEstimees.includes("categorie") && (
                          <Badge variant="outline">{t("journey.feasibility.borrowedDefaults")}</Badge>
                        )}
                        {f?.donneesEstimees.includes("consommation") && (
                          <Badge variant="outline">
                            {t("journey.feasibility.estimatedConsumption")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {celluleCible(pv)}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("journey.feasibility.disclaimer")}</p>
    </div>
  );
}
