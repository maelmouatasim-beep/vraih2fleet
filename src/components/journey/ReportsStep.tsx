/**
 * Étape 6 du parcours — Rapports : le dossier défendable devant un
 * conseil. PDF fr/en (résumé exécutif, plan annuel, stress test,
 * annexe méthodologie/hypothèses) et VRAI classeur Excel (.xlsx,
 * 3 feuilles) — tout depuis le résultat du moteur.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { construireClasseurPlan, type MetaRapport } from "@/lib/journey/report";
import { construireStrategie } from "@/lib/journey/strategies";
import { analyserSensibilite, ENGINE_VERSION } from "@/lib/tco";
import {
  dernierSnapshotRapport,
  insererSnapshotRapport,
  type NouveauSnapshot,
} from "@/lib/supabase/reportSnapshots";
import { formateurCad } from "@/lib/format";
import type { Json } from "@/integrations/supabase/types";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { FileSpreadsheet, FileText, Info, Loader2 } from "lucide-react";
import CouncilReportPDF from "./CouncilReportPDF";

interface ReportsStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsStep({ projectId, project }: ReportsStepProps) {
  const { t, i18n } = useTranslation();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const { options, donneesClient, organization, isLoading: orgLoading } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);
  const [enCours, setEnCours] = useState<string | null>(null);

  const donnees = useMemo(() => {
    if (!options || !organization || projectVehicles.length === 0) return null;
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
    if (!strategie.plan || !strategie.resultat) return null;
    const meta: MetaRapport = {
      organisation: organization.name,
      projet: project.name,
      dateIso: new Date().toISOString().slice(0, 10),
      anneeReference,
      horizonAns: project.defaultAnalysisHorizonYears,
      donneesClient,
    };
    const unites = new Map(projectVehicles.map((pv) => [pv.vehicle_id, pv.vehicles.unit_number]));
    return { strategie, meta, unites };
  }, [options, donneesClient, organization, project, projectVehicles]);

  // Règle A1 : chaque rapport généré FIGE le plan (snapshot immuable).
  // La bannière compare l'empreinte courante au dernier snapshot.
  const queryClient = useQueryClient();
  const { data: dernierSnapshot } = useQuery({
    queryKey: ["report-snapshot", projectId],
    queryFn: () => dernierSnapshotRapport(projectId),
  });

  const figerLeRapport = async (reportKind: NouveauSnapshot["reportKind"]) => {
    const resultat = donnees!.strategie.resultat!;
    try {
      await insererSnapshotRapport({
        projectId,
        strategyKey: "plan_actuel",
        reportKind,
        engineVersion: ENGINE_VERSION,
        fingerprint: resultat.empreinteEntree,
        parameters: {
          parametres: donnees!.strategie.plan!.parametres,
          donneesClient: donnees!.meta.donneesClient ?? [],
        } as unknown as Json,
        van: resultat.vanDifferentielle,
        tcoAlt: resultat.alternative.tcoActualise,
        tcoRef: resultat.reference.tcoActualise,
      });
      queryClient.invalidateQueries({ queryKey: ["report-snapshot", projectId] });
    } catch {
      // Le rapport est déjà téléchargé : l'échec du snapshot ne doit pas
      // le faire disparaître — on le signale seulement.
      toast({ title: t("journey.reports.snapshot.saveError"), variant: "destructive" });
    }
  };

  const genererPdf = async (langue: "fr" | "en") => {
    if (!donnees) return;
    setEnCours(`pdf-${langue}`);
    try {
      const sensibilite = analyserSensibilite(donnees.strategie.plan!);
      const blob = await pdf(
        <CouncilReportPDF
          langue={langue}
          meta={donnees.meta}
          strategie={donnees.strategie}
          sensibilite={sensibilite}
          unites={donnees.unites}
        />,
      ).toBlob();
      telecharger(blob, `h2fleet-plan-${donnees.meta.dateIso}-${langue}.pdf`);
      await figerLeRapport(langue === "fr" ? "pdf_fr" : "pdf_en");
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(null);
    }
  };

  const genererXlsx = async () => {
    if (!donnees) return;
    setEnCours("xlsx");
    try {
      const feuilles = construireClasseurPlan(donnees.strategie, donnees.unites, donnees.meta);
      const classeur = XLSX.utils.book_new();
      for (const f of feuilles) {
        XLSX.utils.book_append_sheet(classeur, XLSX.utils.aoa_to_sheet(f.lignes), f.nom);
      }
      XLSX.writeFile(classeur, `h2fleet-plan-${donnees.meta.dateIso}.xlsx`);
      await figerLeRapport("xlsx");
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(null);
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

  if (!donnees) {
    return (
      <Card>
        <CardContent className="text-center py-16 px-6 space-y-3">
          <p className="font-medium">{t("journey.reports.empty.title")}</p>
          <p className="text-sm text-muted-foreground">{t("journey.reports.empty.subtitle")}</p>
          <Button asChild>
            <Link to={`/dashboard/projects/${projectId}/flotte`}>
              {t("journey.steps.flotte.title")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const resultatCourant = donnees.strategie.resultat!;
  const donneesMisesAJour =
    !!dernierSnapshot && dernierSnapshot.fingerprint !== resultatCourant.empreinteEntree;

  return (
    <div className="space-y-4">
      {donneesMisesAJour && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t("journey.reports.snapshot.updatedTitle")}</AlertTitle>
          <AlertDescription>
            {t("journey.reports.snapshot.updatedBody", {
              date: (dernierSnapshot!.created_at ?? "").slice(0, 10),
              avant: argent.format(dernierSnapshot!.van ?? 0),
              apres: argent.format(resultatCourant.vanDifferentielle),
            })}
          </AlertDescription>
        </Alert>
      )}
      {dernierSnapshot && !donneesMisesAJour && (
        <p className="text-xs text-muted-foreground">
          {t("journey.reports.snapshot.upToDate", {
            date: (dernierSnapshot.created_at ?? "").slice(0, 10),
            version: dernierSnapshot.engine_version,
          })}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" /> {t("journey.reports.pdf.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t("journey.reports.pdf.subtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>{t("journey.reports.pdf.item1")}</li>
              <li>{t("journey.reports.pdf.item2")}</li>
              <li>{t("journey.reports.pdf.item3")}</li>
              <li>{t("journey.reports.pdf.item4")}</li>
            </ul>
            <div className="flex gap-2">
              {(["fr", "en"] as const).map((langue) => (
                <Button
                  key={langue}
                  onClick={() => void genererPdf(langue)}
                  disabled={enCours !== null}
                >
                  {enCours === `pdf-${langue}` ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  {t(`journey.reports.pdf.download_${langue}`)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="w-5 h-5" /> {t("journey.reports.xlsx.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t("journey.reports.xlsx.subtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>{t("journey.reports.xlsx.item1")}</li>
              <li>{t("journey.reports.xlsx.item2")}</li>
              <li>{t("journey.reports.xlsx.item3")}</li>
            </ul>
            <Button onClick={genererXlsx} disabled={enCours !== null} variant="outline">
              {enCours === "xlsx" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              {t("journey.reports.xlsx.download")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">{t("journey.reports.note")}</p>
    </div>
  );
}
