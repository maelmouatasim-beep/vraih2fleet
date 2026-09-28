import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkInsertVehicles,
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
  type VehicleInsert,
  type VehicleUpdate,
} from "@/lib/fleet/vehicles";

/** Flotte de l'organisation (« Ma flotte »). */
export function useVehicles(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const cle = ["vehicles", organizationId];

  const query = useQuery({
    queryKey: cle,
    queryFn: () => listVehicles(organizationId!),
    enabled: !!organizationId,
  });

  const invalider = () => queryClient.invalidateQueries({ queryKey: cle });

  const creer = useMutation({
    mutationFn: (v: VehicleInsert) => createVehicle(v),
    onSuccess: invalider,
  });
  const importer = useMutation({
    mutationFn: (vs: VehicleInsert[]) => bulkInsertVehicles(vs),
    onSuccess: invalider,
  });
  const modifier = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: VehicleUpdate }) => updateVehicle(id, patch),
    onSuccess: invalider,
  });
  const supprimer = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: invalider,
  });

  return {
    vehicles: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    creer,
    importer,
    modifier,
    supprimer,
  };
}
