import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addProjectVehicles,
  listProjectVehicles,
  removeProjectVehicle,
  updateProjectVehicle,
  type ProjectVehicleInsert,
  type ProjectVehicleUpdate,
} from "@/lib/fleet/projectVehicles";

/** Véhicules inclus dans un projet (étape Flotte du parcours). */
export function useProjectVehicles(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const cle = ["project-vehicles", projectId];

  const query = useQuery({
    queryKey: cle,
    queryFn: () => listProjectVehicles(projectId!),
    enabled: !!projectId,
  });

  const invalider = () => queryClient.invalidateQueries({ queryKey: cle });

  const ajouter = useMutation({
    mutationFn: (lignes: ProjectVehicleInsert[]) => addProjectVehicles(lignes),
    onSuccess: invalider,
  });
  const modifier = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectVehicleUpdate }) =>
      updateProjectVehicle(id, patch),
    onSuccess: invalider,
  });
  const retirer = useMutation({
    mutationFn: (id: string) => removeProjectVehicle(id),
    onSuccess: invalider,
  });

  return {
    projectVehicles: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    ajouter,
    modifier,
    retirer,
  };
}
