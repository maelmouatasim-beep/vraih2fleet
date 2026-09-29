import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSubsidyApplication,
  deleteSubsidyApplication,
  listSubsidyApplications,
  listSubsidyTasks,
  updateSubsidyApplication,
  type SubsidyApplicationInsert,
  type SubsidyApplicationUpdate,
} from "@/lib/supabase/subsidyApplications";

/** Suivi des demandes de subvention d'un projet (C5) + tâches liées. */
export function useSubsidyApplications(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const cle = ["subsidy_applications", projectId];

  const query = useQuery({
    queryKey: cle,
    queryFn: () => listSubsidyApplications(projectId!),
    enabled: !!projectId,
  });

  const taches = useQuery({
    queryKey: ["subsidy_tasks", projectId],
    queryFn: () => listSubsidyTasks(projectId!),
    enabled: !!projectId,
  });

  const invalider = () => queryClient.invalidateQueries({ queryKey: cle });

  const creer = useMutation({
    mutationFn: (row: SubsidyApplicationInsert) => createSubsidyApplication(row),
    onSuccess: invalider,
  });
  const modifier = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SubsidyApplicationUpdate }) =>
      updateSubsidyApplication(id, patch),
    onSuccess: invalider,
  });
  const supprimer = useMutation({
    mutationFn: (id: string) => deleteSubsidyApplication(id),
    onSuccess: invalider,
  });

  return {
    applications: query.data ?? [],
    tachesSubvention: taches.data ?? [],
    isLoading: query.isLoading,
    creer,
    modifier,
    supprimer,
  };
}
