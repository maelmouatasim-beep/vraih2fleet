/**
 * Étape 4 du parcours — Plan : le plan de remplacement véhicule par
 * véhicule, année par année, avec le budget annuel (PTI = investissement,
 * fonctionnement) tiré de la vueBudgetaire du moteur pour la stratégie
 * « Plan actuel » (technos cibles et années choisies à l'étape Flotte).
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { construireStrategie } from "@/lib/journey/strategies";
import { formateurCad, formateurCadCompact } from "@/lib/format";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { Loader2 } from "lucide-react";

interface PlanStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function PlanStep({ projectId, project }: PlanStepProps) {
  const { t, i18n } = useTranslation();
  const { options, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);

  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const compact = useMemo(() => formateurCadCompact(i18n.language), [i18n.language]);

  const donnees = useMemo(() => {
    if (!options || projectVehicles.length === 0) return null;
    const anneeReference = options.anneeReference;
    const strategie = construireStrategie(
      projectVehicles.map((pv) => ({
        ...pv.vehicles,
        replacement_year: pv.replacement_year,
        target_technology: pv.target_technology,
      })),
      "plan_actuel",
      options,
    );
    if (!strategie.resultat || !strategie.plan) return null;

    // Remplacements par année calendaire (unités + techno cible)
    const uniteParId = new Map(projectVehicles.map((pv) => [pv.vehicle_id, pv.vehicles.unit_number]));
    const remplacements = new Map<number, { unite: string; techno: string }[]>();
    for (const v of strategie.plan.vehicules) {
      const annee = anneeReference + (v.anneeAcquisition ?? 0);
      const liste = remplacements.get(annee) ?? [];
      liste.push({ unite: uniteParId.get(v.id) ?? v.id, techno: v.alternative.technologie });
      remplacements.set(annee, liste);
    }

    const totaux = strategie.resultat.vueBudgetaire.reduce(
      (a, l) => ({
        investissement: a.investissement + l.investissementAlt,
        subventions: a.subventions + l.subventionsAlt,
        resteAFinancer: a.resteAFinancer + l.resteAFinancerAlt,
      }),
      { investissement: 0, subventions: 0, resteAFinancer: 0 },
    );

    return { strategie, resultat: strategie.resultat, remplacements, totaux };
  }, [options, projectVehicles]);

  if (orgLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (projectVehicles.length === 0 || !donnees) {
    return (
      <Card>
        <CardContent className="text-center py-16 px-6 space-y-3">
          <p className="font-medium">{t("journey.plan.empty.title")}</p>
          <p className="text-sm text-muted-foreground">{t("journey.plan.empty.subtitle")}</p>
          <Button asChild>
            <Link to={`/dashboard/projects/${projectId}/flotte`}>
              {t("journey.steps.flotte.title")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { resultat, remplacements, totaux } = donnees;
  const graphe = resultat.vueBudgetaire.map((l) => ({
    annee: String(l.annee),
    pti: Math.round(l.resteAFinancerAlt),
    fonctionnement: Math.round(l.fonctionnementAlt),
    ecart: Math.round(l.ecart),
  }));

  const badgeTechno = (techno: string) =>
    techno === "diesel" ? (
      <Badge variant="outline">{t("journey.fleet.targets.diesel")}</Badge>
    ) : techno === "BEV" ? (
      <Badge variant="default">{t("journey.fleet.targets.bev")}</Badge>
    ) : (
      <Badge variant="secondary">{t("journey.fleet.targets.fcev")}</Badge>
    );

  return (
    <div className="space-y-4">
      {donnees && donnees.strategie.horsHorizon.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("journey.strategies.outOfHorizon", {
            count: donnees.strategie.horsHorizon.length,
            liste: donnees.strategie.horsHorizon
              .map(
                (h) =>
                  `${projectVehicles.find((pv) => pv.vehicle_id === h.id)?.vehicles.unit_number ?? "?"} (${h.anneeRemplacement})`,
              )
              .join(", "),
          })}
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            ["investment", argent.format(totaux.investissement)],
            ["subsidies", argent.format(totaux.subventions)],
            ["toFinance", argent.format(totaux.resteAFinancer)],
            [
              "netSavings",
              argent.format(resultat.vanDifferentielle),
            ],
          ] as const
        ).map(([cle, valeur]) => (
          <Card key={cle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                {t(`journey.plan.stats.${cle}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{valeur}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("journey.plan.chartTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("journey.plan.chartSubtitle")}</p>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={graphe}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="annee" className="text-xs" />
              <YAxis tickFormatter={(v: number) => compact.format(v)} className="text-xs" />
              <Tooltip
                formatter={(value: number, name: string) => [argent.format(value), t(`journey.plan.series.${name}`)]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend formatter={(value: string) => t(`journey.plan.series.${value}`)} />
              <Bar dataKey="pti" stackId="budget" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fonctionnement" stackId="budget" fill="hsl(var(--muted-foreground))" fillOpacity={0.45} />
              <Line dataKey="ecart" stroke="hsl(160, 84%, 30%)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("journey.plan.tableTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("journey.plan.tableSubtitle")}</p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("journey.plan.columns.year")}</TableHead>
                <TableHead>{t("journey.plan.columns.replacements")}</TableHead>
                <TableHead className="text-right">{t("journey.plan.columns.investment")}</TableHead>
                <TableHead className="text-right">{t("journey.plan.columns.subsidies")}</TableHead>
                <TableHead className="text-right">{t("journey.plan.columns.toFinance")}</TableHead>
                <TableHead className="text-right">{t("journey.plan.columns.operating")}</TableHead>
                <TableHead className="text-right">{t("journey.plan.columns.gap")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultat.vueBudgetaire.map((l) => {
                const liste = remplacements.get(l.annee) ?? [];
                return (
                  <TableRow key={l.annee}>
                    <TableCell className="font-medium">{l.annee}</TableCell>
                    <TableCell>
                      {liste.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {liste.map((r) => (
                            <span key={r.unite} className="inline-flex items-center gap-1 text-xs">
                              <span className="font-medium">{r.unite}</span>
                              {badgeTechno(r.techno)}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.investissementAlt > 0 ? argent.format(l.investissementAlt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.subventionsAlt > 0 ? argent.format(l.subventionsAlt) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {l.resteAFinancerAlt !== 0 ? argent.format(l.resteAFinancerAlt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.fonctionnementAlt > 0 ? argent.format(l.fonctionnementAlt) : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right ${l.ecart >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {argent.format(l.ecart)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("journey.plan.note")}</p>
    </div>
  );
}
