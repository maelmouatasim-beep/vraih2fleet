/**
 * Étape 3 du parcours — Stratégies : trois stratégies de remplacement
 * chiffrées par LE moteur TCO (année d'acquisition par véhicule,
 * subventions du registre, infra du dépôt), puis stress test (§7) de la
 * stratégie sélectionnée.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganization } from "@/hooks/useOrganization";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { construireStrategies, type CleStrategie } from "@/lib/journey/strategies";
import { formateurCad } from "@/lib/format";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";
import StressTestPanel from "./StressTestPanel";

interface StrategiesStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function StrategiesStep({ projectId, project }: StrategiesStepProps) {
  const { t, i18n } = useTranslation();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);
  const [selection, setSelection] = useState<CleStrategie>("plan_actuel");

  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  const strategies = useMemo(() => {
    if (!project || !organization || projectVehicles.length === 0) return null;
    const options = {
      anneeReference: new Date().getFullYear(),
      horizonAns: project.defaultAnalysisHorizonYears,
      tauxActualisationNominal: project.defaultDiscountRate / 100,
      typeOrganisme: organization.orgType,
    };
    return construireStrategies(
      projectVehicles.map((pv) => ({
        ...pv.vehicles,
        replacement_year: pv.replacement_year,
        target_technology: pv.target_technology,
      })),
      options,
    );
  }, [project, organization, projectVehicles]);

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

  const meilleureVan = Math.max(
    ...strategies.map((s) => s.resultat?.vanDifferentielle ?? Number.NEGATIVE_INFINITY),
  );
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
                </div>
                {active && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
              </div>
              {r ? (
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
                        : t("journey.feasibility.noPayback")}
                    </p>
                    <p>{t("journey.strategies.metrics.infra", { amount: argent.format(s.infraCapex) })}</p>
                    <p>
                      {t("journey.strategies.metrics.subsidies", {
                        amount: argent.format(s.subventionsTotal),
                      })}
                    </p>
                  </div>
                  {van === meilleureVan && strategies.filter((x) => x.resultat).length > 1 && (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("journey.strategies.methodTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>{t("journey.strategies.methodNote1")}</p>
          <p>{t("journey.strategies.methodNote2")}</p>
          {selectionnee.resultat && selectionnee.resultat.avertissements.length > 0 && (
            <ul className="list-disc pl-5 pt-1">
              {selectionnee.resultat.avertissements.slice(0, 5).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectionnee.plan && <StressTestPanel plan={selectionnee.plan} />}
    </div>
  );
}
