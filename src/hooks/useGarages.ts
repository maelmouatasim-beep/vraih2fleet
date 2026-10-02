import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGarage,
  deleteGarage,
  listGarages,
  updateGarage,
  type GarageInsert,
  type GarageUpdate,
} from "@/lib/fleet/garages";

/** Garages de l'organisation (bornes, raccordement, fenêtre de recharge). */
export function useGarages(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const cle = ["garages", organizationId];

  const query = useQuery({
    queryKey: cle,
    queryFn: () => listGarages(organizationId!),
    enabled: !!organizationId,
  });

  const invalider = () => {
    queryClient.invalidateQueries({ queryKey: cle });
    queryClient.invalidateQueries({ queryKey: ["vehicles", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["project-vehicles"] });
  };

  const creer = useMutation({ mutationFn: (g: GarageInsert) => createGarage(g), onSuccess: invalider });
  const modifier = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: GarageUpdate }) => updateGarage(id, patch),
    onSuccess: invalider,
  });
  const supprimer = useMutation({ mutationFn: (id: string) => deleteGarage(id), onSuccess: invalider });

  return { garages: query.data ?? [], isLoading: query.isLoading, creer, modifier, supprimer };
}
