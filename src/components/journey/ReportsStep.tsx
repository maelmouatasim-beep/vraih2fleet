/**
 * Étape 6 du parcours — Rapports : le dossier défendable devant un
 * conseil. PDF fr/en (résumé exécutif, plan annuel, stress test,
 * annexe méthodologie/hypothèses) et VRAI classeur Excel (.xlsx,
 * 3 feuilles) — tout depuis le résultat du moteur.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { construireClasseurPlan, type MetaRapport } from "@/lib/journey/report";
import { construireStrategie } from "@/lib/journey/strategies";
import { analyserSensibilite } from "@/lib/tco";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
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
  const { t } = useTranslation();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);
  const [enCours, setEnCours] = useState<string | null>(null);

  const donnees = useMemo(() => {
    if (!project || !organization || projectVehicles.length === 0) return null;
    const anneeReference = new Date().getFullYear();
    const strategie = construireStrategie(
      projectVehicles.map((pv) => ({
        ...pv.vehicles,
        replacement_year: pv.replacement_year,
        target_technology: pv.target_technology,
      })),
      "plan_actuel",
      {
        anneeReference,
        horizonAns: project.defaultAnalysisHorizonYears,
        tauxActualisationNominal: project.defaultDiscountRate / 100,
        typeOrganisme: organization.orgType,
      },
    );
    if (!strategie.plan || !strategie.resultat) return null;
    const meta: MetaRapport = {
      organisation: organization.name,
      projet: project.name,
      dateIso: new Date().toISOString().slice(0, 10),
      anneeReference,
      horizonAns: project.defaultAnalysisHorizonYears,
    };
    const unites = new Map(projectVehicles.map((pv) => [pv.vehicle_id, pv.vehicles.unit_number]));
    return { strategie, meta, unites };
  }, [project, organization, projectVehicles]);

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
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(null);
    }
  };

  const genererXlsx = () => {
    if (!donnees) return;
    setEnCours("xlsx");
    try {
      const feuilles = construireClasseurPlan(donnees.strategie, donnees.unites, donnees.meta);
      const classeur = XLSX.utils.book_new();
      for (const f of feuilles) {
        XLSX.utils.book_append_sheet(classeur, XLSX.utils.aoa_to_sheet(f.lignes), f.nom);
      }
      XLSX.writeFile(classeur, `h2fleet-plan-${donnees.meta.dateIso}.xlsx`);
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

  return (
    <div className="space-y-4">
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
