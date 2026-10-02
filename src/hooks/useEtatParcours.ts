import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { useConfirmedSubsidies } from "@/hooks/useConfirmedSubsidies";
import { useSubsidyApplications } from "@/hooks/useSubsidyApplications";
import { dernierSnapshotRapport } from "@/lib/supabase/reportSnapshots";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { construireStrategie } from "@/lib/journey/strategies";
import { etatDuParcours } from "@/lib/journey/progress";
import { vehiculeProjetDepuis } from "@/lib/journey/vehiculeProjet";

/** État réel des 7 étapes (bloc 3.2), à partir des données du projet. */
export function useEtatParcours(projectId: string | undefined, project: ProjectDTO | null | undefined) {
  const { options } = useOptionsProjet(project, projectId);
  const { projectVehicles, isLoading } = useProjectVehicles(projectId);
  const { confirmeesParVehicule } = useConfirmedSubsidies(projectId);
  const { applications } = useSubsidyApplications(projectId);
  const { data: snapshot } = useQuery({
    queryKey: ["report-snapshot", projectId],
    queryFn: () => dernierSnapshotRapport(projectId!),
    enabled: !!projectId,
  });

  return useMemo(() => {
    if (!project || isLoading) return null;
    const vehicules = projectVehicles.map((pv) => vehiculeProjetDepuis(pv, confirmeesParVehicule.get(pv.vehicle_id)));
    const strategie = options && vehicules.length > 0 ? construireStrategie(vehicules, "plan_actuel", options) : null;
    const programmesPrevus = strategie
      ? Object.values(strategie.explicationsSubventions)
          .flat()
          .filter((e) => e.montant > 0)
          .map((e) => e.programmeId)
      : [];
    const zeroEmission = projectVehicles.filter((pv) => pv.target_technology === "bev" || pv.target_technology === "fcev");
    return etatDuParcours({
      nbVehicules: projectVehicles.length,
      nbSansAnnee: projectVehicles.filter((pv) => pv.replacement_year == null).length,
      nbSansCible: projectVehicles.filter((pv) => pv.target_technology == null).length,
      strategieAppliquee: !!project.selectedStrategy,
      nbZeroEmission: zeroEmission.length,
      programmesPrevus,
      programmesDemandes: (applications ?? []).map((a) => a.program_id),
      rapportGenere: !!snapshot,
      rapportAJour: snapshot && strategie?.resultat ? snapshot.fingerprint === strategie.resultat.empreinteEntree : null,
      nbRealises: zeroEmission.filter((pv) => pv.completed_date != null).length,
    });
  }, [project, isLoading, projectVehicles, confirmeesParVehicule, options, applications, snapshot]);
}
