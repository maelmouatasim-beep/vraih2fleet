/**
 * Étape 2 du parcours — Faisabilité : verdict par véhicule (BEV et FCEV)
 * avec la raison chiffrée par le moteur TCO (économie actualisée vs
 * diesel neuf, payback, CO2 évité). Calcul local et pur (src/lib/journey/
 * feasibility.ts) sur les véhicules sélectionnés à l'étape Flotte.
 */
import { useMemo } from "react";
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
import { useOrganization } from "@/hooks/useOrganization";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import {
  evaluerFaisabiliteVehicule,
  type EvaluationTechno,
  type FaisabiliteVehicule,
} from "@/lib/journey/feasibility";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { Loader2 } from "lucide-react";

interface FeasibilityStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function FeasibilityStep({ projectId, project }: FeasibilityStepProps) {
  const { t, i18n } = useTranslation();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);

  const evaluations = useMemo(() => {
    if (!project || !organization) return null;
    const options = {
      anneeReference: new Date().getFullYear(),
      horizonAns: project.defaultAnalysisHorizonYears,
      // defaultDiscountRate est stocké en pour cent (5 = 5 %)
      tauxActualisationNominal: project.defaultDiscountRate / 100,
      typeOrganisme: organization.orgType,
    };
    const parVehicule = new Map<string, FaisabiliteVehicule>();
    for (const pv of projectVehicles) {
      parVehicule.set(pv.vehicle_id, evaluerFaisabiliteVehicule(pv.vehicles, options));
    }
    return parVehicule;
  }, [project, organization, projectVehicles]);

  const argent = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language.startsWith("fr") ? "fr-CA" : "en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );

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
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
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

  const verdictBadge = (e: EvaluationTechno | undefined) => {
    if (!e) return <Badge variant="outline">{t("journey.feasibility.verdicts.non_evaluable")}</Badge>;
    const variante =
      e.verdict === "favorable" ? "default" : e.verdict === "conditionnel" ? "secondary" : "destructive";
    return <Badge variant={variante}>{t(`journey.feasibility.verdicts.${e.verdict}`)}</Badge>;
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
            : t("journey.feasibility.noPayback")}
          {" · "}
          {t("journey.feasibility.co2Avoided", { tonnes: e.co2EviteWtwTonnes.toFixed(0) })}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            ["favorable", stats.favorables],
            ["conditional", stats.conditionnels],
            ["unfavorable", stats.defavorables],
            ["notAssessable", stats.nonEvaluables],
          ] as const
        ).map(([cle, valeur]) => (
          <Card key={cle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                {t(`journey.feasibility.stats.${cle}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{valeur}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <TableHead>{t("journey.feasibility.columns.bev")}</TableHead>
                <TableHead>{t("journey.feasibility.columns.fcev")}</TableHead>
                <TableHead>{t("journey.feasibility.columns.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectVehicles.map((pv) => {
                const f = evaluations.get(pv.vehicle_id);
                const [bev, fcev] = f?.evaluations ?? [undefined, undefined];
                const reserves = new Set([...(bev?.reserves ?? []), ...(fcev?.reserves ?? [])]);
                return (
                  <TableRow key={pv.id}>
                    <TableCell className="font-medium">{pv.vehicles.unit_number}</TableCell>
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
                      {f?.kmParAnRetenu != null ? f.kmParAnRetenu.toLocaleString("fr-CA") : "—"}
                      {f?.donneesEstimees.includes("km") && (
                        <p className="text-xs text-muted-foreground">{t("fleet.source.estimation")}</p>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {verdictBadge(bev)}
                      {detailTechno(bev)}
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
                        {f?.donneesEstimees.includes("consommation") && (
                          <Badge variant="outline">
                            {t("journey.feasibility.estimatedConsumption")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
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
