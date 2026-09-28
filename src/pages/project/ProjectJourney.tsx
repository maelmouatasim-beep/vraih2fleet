import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectById } from "@/lib/supabase/projects";
import FleetStep from "@/components/journey/FleetStep";
import FeasibilityStep from "@/components/journey/FeasibilityStep";
import StrategiesStep from "@/components/journey/StrategiesStep";
import PlanStep from "@/components/journey/PlanStep";
import FinancingStep from "@/components/journey/FinancingStep";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Banknote,
  CheckCircle2,
  ClipboardList,
  FileText,
  ListChecks,
  Truck,
} from "lucide-react";

/** Les 7 étapes du parcours projet (direction produit) :
 *  Flotte → Faisabilité → Stratégies → Plan → Financement → Rapports → Suivi. */
export const ETAPES_PARCOURS = [
  "flotte",
  "faisabilite",
  "strategies",
  "plan",
  "financement",
  "rapports",
  "suivi",
] as const;

export type EtapeParcours = (typeof ETAPES_PARCOURS)[number];

const ICONES: Record<EtapeParcours, typeof Truck> = {
  flotte: Truck,
  faisabilite: CheckCircle2,
  strategies: BarChart3,
  plan: ClipboardList,
  financement: Banknote,
  rapports: FileText,
  suivi: ListChecks,
};

interface ProjectJourneyProps {
  etape: EtapeParcours;
}

/**
 * Parcours projet : navigation, barre de progression et contenu des
 * étapes. Le contenu réel arrive en Phase 3, bloc par bloc, branché sur
 * le moteur src/lib/tco ; les étapes non livrées gardent leur coquille.
 */
export default function ProjectJourney({ etape }: ProjectJourneyProps) {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectById(projectId!),
    enabled: !!projectId,
  });

  const indexEtape = ETAPES_PARCOURS.indexOf(etape);
  const base = `/dashboard/projects/${projectId}`;

  const ctaParEtape: Partial<Record<EtapeParcours, { href: string; libelle: string }[]>> = {
    rapports: [{ href: base, libelle: t("journey.cta.projectOverview") }],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link
              to="/dashboard/projects"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" /> {t("journey.backToProjects")}
            </Link>
            <h1 className="text-2xl font-bold text-foreground mt-1">
              {project?.name ?? "…"}
            </h1>
            <p className="text-muted-foreground">{t("journey.subtitle")}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to={base}>{t("journey.cta.projectOverview")}</Link>
          </Button>
        </div>

        {/* Barre de progression des 7 étapes */}
        <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
          <ol className="flex items-center gap-2 min-w-[720px]">
            {ETAPES_PARCOURS.map((e, i) => {
              const Icone = ICONES[e];
              const actif = e === etape;
              const fait = i < indexEtape;
              return (
                <li key={e} className="flex items-center flex-1 min-w-0">
                  <Link
                    to={`${base}/${e}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
                      actif
                        ? "bg-primary text-primary-foreground"
                        : fait
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                        actif
                          ? "border-primary-foreground/40"
                          : fait
                            ? "border-primary bg-primary/10"
                            : "border-border",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Icone className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t(`journey.steps.${e}.title`)}</span>
                  </Link>
                  {i < ETAPES_PARCOURS.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mx-1" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Contenu de l'étape (Phase 3, bloc par bloc) */}
        {etape === "flotte" && projectId ? (
          <FleetStep projectId={projectId} />
        ) : etape === "faisabilite" && projectId ? (
          <FeasibilityStep projectId={projectId} project={project} />
        ) : etape === "strategies" && projectId ? (
          <StrategiesStep projectId={projectId} project={project} />
        ) : etape === "plan" && projectId ? (
          <PlanStep projectId={projectId} project={project} />
        ) : etape === "financement" && projectId ? (
          <FinancingStep projectId={projectId} project={project} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const Icone = ICONES[etape];
                  return <Icone className="w-5 h-5" />;
                })()}
                {t(`journey.steps.${etape}.title`)}
              </CardTitle>
              <CardDescription>{t(`journey.steps.${etape}.description`)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t(`journey.steps.${etape}.placeholder`)}</p>
              <div className="flex flex-wrap gap-2">
                {(ctaParEtape[etape] ?? []).map((cta) => (
                  <Button key={cta.href} variant="outline" asChild>
                    <Link to={cta.href}>{cta.libelle}</Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation vers l'étape suivante */}
        {indexEtape < ETAPES_PARCOURS.length - 1 && (
          <div className="flex justify-end">
            <Button asChild>
              <Link to={`${base}/${ETAPES_PARCOURS[indexEtape + 1]}`}>
                {t("journey.nextStep")} <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
