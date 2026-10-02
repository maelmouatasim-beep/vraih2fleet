/**
 * Étape 5 du parcours — Financement : les subventions du plan, véhicule
 * par véhicule (résolues par le registre du moteur), et le registre des
 * programmes avec statut CALCULÉ à partir des dates (jamais le statut
 * stocké seul) et date de vérification visible.
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
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useConfirmedSubsidies } from "@/hooks/useConfirmedSubsidies";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { construireStrategie } from "@/lib/journey/strategies";
import { PROGRAMMES, statutEffectif } from "@/lib/tco";
import { formateurCad } from "@/lib/format";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { ExternalLink, Loader2 } from "lucide-react";
import ConfirmedSubsidiesCard from "./ConfirmedSubsidiesCard";
import SubsidyApplicationsCard from "./SubsidyApplicationsCard";
import { cumulProgramme, nomProgramme, traduireLibelleSubvention } from "@/lib/tco/translations-en";
import { texteExplication } from "@/lib/journey/subsidy-explain";

interface FinancingStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function FinancingStep({ projectId, project }: FinancingStepProps) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language === "en" ? "en" : "fr";
  const { options, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);
  const { confirmeesParVehicule } = useConfirmedSubsidies(projectId);

  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const aujourdHui = new Date().toISOString().slice(0, 10);

  const donnees = useMemo(() => {
    if (!options || projectVehicles.length === 0) return null;
    const anneeReference = options.anneeReference;
    const strategie = construireStrategie(
      projectVehicles.map((pv) => ({
        ...pv.vehicles,
        replacement_year: pv.replacement_year,
        target_technology: pv.target_technology,
        subventionsConfirmees: confirmeesParVehicule.get(pv.vehicle_id),
      })),
      "plan_actuel",
      options,
    );
    if (!strategie.plan || !strategie.resultat) return null;
    const uniteParId = new Map(projectVehicles.map((pv) => [pv.vehicle_id, pv.vehicles.unit_number]));
    const lignes = strategie.plan.vehicules
      .filter((v) => v.alternative.technologie !== "diesel")
      .map((v) => ({
        unite: uniteParId.get(v.id) ?? v.id,
        techno: v.alternative.technologie,
        anneeAchat: anneeReference + (v.anneeAcquisition ?? 0),
        subventions: v.subventionsAlternative ?? [],
        explications: strategie.explicationsSubventions[v.id] ?? [],
        total: (v.subventionsAlternative ?? []).reduce((a, s) => a + s.montant, 0),
      }))
      .sort((a, b) => a.anneeAchat - b.anneeAchat || a.unite.localeCompare(b.unite, "fr"));
    const resteAFinancer = strategie.resultat.vueBudgetaire.reduce(
      (a, l) => a + l.resteAFinancerAlt,
      0,
    );
    return { lignes, total: strategie.subventionsTotal, resteAFinancer, anneeReference, strategie };
  }, [options, projectVehicles, confirmeesParVehicule]);

  if (orgLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const badgeStatut = (statut: string, dateFin?: string) => {
    if (statut === "actif") {
      return <Badge variant="default">{t("journey.financing.status.actif")}</Badge>;
    }
    if (statut === "ferme") {
      return (
        <Badge variant="destructive">
          {dateFin && dateFin < aujourdHui
            ? t("journey.financing.status.echu", { date: dateFin })
            : t("journey.financing.status.ferme")}
        </Badge>
      );
    }
    return <Badge variant="outline">{t("journey.financing.status.suspendu")}</Badge>;
  };

  const badgeVerification = (statut: string) =>
    statut === "verifie" ? (
      <Badge variant="secondary">{t("journey.financing.verified")}</Badge>
    ) : (
      <Badge variant="outline">{t("journey.financing.toValidate")}</Badge>
    );

  const nbActifs = PROGRAMMES.filter((p) => statutEffectif(p, aujourdHui) === "actif").length;

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
            ["planned", donnees ? argent.format(donnees.total) : "—"],
            ["aidedVehicles", donnees ? String(donnees.lignes.filter((l) => l.total > 0).length) : "—"],
            ["toFinance", donnees ? argent.format(donnees.resteAFinancer) : "—"],
            ["activePrograms", String(nbActifs)],
          ] as const
        ).map(([cle, valeur]) => (
          <Card key={cle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                {t(`journey.financing.stats.${cle}`)}
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
          <CardTitle className="text-lg">{t("journey.financing.planTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("journey.financing.planSubtitle")}</p>
        </CardHeader>
        <CardContent className="p-0">
          {!donnees || donnees.lignes.length === 0 ? (
            <div className="text-center py-12 px-6 space-y-3">
              <p className="text-sm text-muted-foreground">{t("journey.financing.empty")}</p>
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
                  <TableHead>{t("journey.fleet.columns.target")}</TableHead>
                  <TableHead>{t("journey.financing.columns.purchaseYear")}</TableHead>
                  <TableHead>{t("journey.financing.columns.programs")}</TableHead>
                  <TableHead className="text-right">{t("journey.financing.columns.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donnees.lignes.map((l) => (
                  <TableRow key={l.unite}>
                    <TableCell className="font-medium">{l.unite}</TableCell>
                    <TableCell>
                      {t(`journey.fleet.targets.${l.techno === "BEV" ? "bev" : "fcev"}`)}
                    </TableCell>
                    <TableCell>{l.anneeAchat}</TableCell>
                    <TableCell className="max-w-[520px]">
                      {l.subventions.length === 0 ? (
                        <span className="text-muted-foreground text-sm">
                          {t("journey.financing.noProgram")}
                        </span>
                      ) : (
                        <div className="space-y-0.5 text-sm">
                          {l.subventions.map((s) => (
                            <p key={s.libelle}>
                              {traduireLibelleSubvention(s.libelle, langue)} — {argent.format(s.montant)}{" "}
                              <span className="text-muted-foreground">
                                ({t("journey.financing.paidIn", { year: donnees.anneeReference + s.annee })})
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                      {l.explications.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {l.explications.map((e) => (
                            <li key={e.programmeId}>{texteExplication(e, langue)}</li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {l.total > 0 ? argent.format(l.total) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SubsidyApplicationsCard
        projectId={projectId}
        vehicules={projectVehicles.map((pv) => ({
          vehicleId: pv.vehicle_id,
          unite: pv.vehicles.unit_number,
        }))}
      />

      <ConfirmedSubsidiesCard
        projectId={projectId}
        vehicules={projectVehicles.map((pv) => ({
          vehicleId: pv.vehicle_id,
          unite: pv.vehicles.unit_number,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("journey.financing.registryTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("journey.financing.registrySubtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {PROGRAMMES.map((prog) => {
            const statut = statutEffectif(prog, aujourdHui);
            const plafondMax = Math.max(...prog.baremes.map((b) => b.plafondParVehicule), 0);
            return (
              <div key={prog.id} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{nomProgramme(prog.id, langue)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{t(`journey.financing.level.${prog.palier}`)}</Badge>
                    <Badge variant="outline">{t(`journey.financing.target.${prog.cible}`)}</Badge>
                    {badgeStatut(statut, prog.dateFin)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {plafondMax > 0 && (
                    <p>{t("journey.financing.maxPerVehicle", { amount: argent.format(plafondMax) })}</p>
                  )}
                  {prog.bonificationAchatLocal && (
                    <p>
                      {t("journey.financing.localBonus", {
                        percent: Math.round(prog.bonificationAchatLocal * 100),
                      })}
                    </p>
                  )}
                  <p>{cumulProgramme(prog.id, langue)}</p>
                  {prog.dateFin && statut === "actif" && (
                    <p>{t("journey.financing.until", { date: prog.dateFin })}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/60">
                  {badgeVerification(prog.statutVerification)}
                  <span>{t("journey.financing.verifiedOn", { date: prog.dateVerification })}</span>
                  <a
                    href={prog.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground underline underline-offset-2"
                  >
                    {prog.source.organisme} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("journey.financing.disclaimer")}</p>
    </div>
  );
}
