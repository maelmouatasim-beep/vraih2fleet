import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getProjectById } from "@/lib/supabase/projects";
import FleetStep from "@/components/journey/FleetStep";
import ProjectSettingsDialog from "@/components/journey/ProjectSettingsDialog";
import { ShareProjectButton } from "@/components/collaboration";
import FeasibilityStep from "@/components/journey/FeasibilityStep";
import StrategiesStep from "@/components/journey/StrategiesStep";
import PlanStep from "@/components/journey/PlanStep";
import FinancingStep from "@/components/journey/FinancingStep";
import ReportsStep from "@/components/journey/ReportsStep";
import TrackingStep from "@/components/journey/TrackingStep";
import CopilotPanel from "@/components/copilot/CopilotPanel";
import { ETAPES_PARCOURS, type EtapeParcoursCle } from "@/lib/journey/steps";
import { useEtatParcours } from "@/hooks/useEtatParcours";
import JourneyStepper from "@/components/journey/JourneyStepper";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export { ETAPES_PARCOURS };
export type EtapeParcours = EtapeParcoursCle;

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
  const etats = useEtatParcours(projectId, project);
  const [copiloteOuvert, setCopiloteOuvert] = useState(false);

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
          {project && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setCopiloteOuvert(true)} data-testid="open-copilot">
                <Sparkles className="w-4 h-4 mr-2" />
                {t("copilot.open")}
              </Button>
              <ShareProjectButton projectId={project.id} />
              <ProjectSettingsDialog project={project} />
            </div>
          )}
        </div>

        {/* Barre des 7 étapes : composant unique */}
        <JourneyStepper base={base} etape={etape} etats={etats} />

        {/* Contenu de l'étape (Phase 3, bloc par bloc) */}
        {etape === "flotte" && projectId ? (
          <FleetStep projectId={projectId} project={project} />
        ) : etape === "faisabilite" && projectId ? (
          <FeasibilityStep projectId={projectId} project={project} />
        ) : etape === "strategies" && projectId ? (
          <StrategiesStep projectId={projectId} project={project} />
        ) : etape === "plan" && projectId ? (
          <PlanStep projectId={projectId} project={project} />
        ) : etape === "financement" && projectId ? (
          <FinancingStep projectId={projectId} project={project} />
        ) : etape === "rapports" && projectId ? (
          <ReportsStep projectId={projectId} project={project} />
        ) : etape === "suivi" && projectId ? (
          <TrackingStep projectId={projectId} project={project} />
        ) : null}

        {projectId && (
          <CopilotPanel projectId={projectId} project={project} open={copiloteOuvert} onOpenChange={setCopiloteOuvert} />
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
