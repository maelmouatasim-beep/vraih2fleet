/**
 * Subventions confirmées par le client, par projet : liste, ajout,
 * suppression, et regroupement par véhicule prêt pour le moteur.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parVehicule, type SubventionConfirmee } from "@/lib/confirmedSubsidies";
import {
  addConfirmedSubsidy,
  listConfirmedSubsidies,
  removeConfirmedSubsidy,
  type ConfirmedSubsidy,
} from "@/lib/supabase/confirmedSubsidies";
import type { TablesInsert } from "@/integrations/supabase/types";

export function useConfirmedSubsidies(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const cle = ["confirmed-subsidies", projectId];

  const query = useQuery({
    queryKey: cle,
    queryFn: () => listConfirmedSubsidies(projectId!),
    enabled: !!projectId,
  });
  const invalider = () => {
    queryClient.invalidateQueries({ queryKey: cle });
  };

  const ajouter = useMutation({
    mutationFn: (
      ligne: Omit<TablesInsert<"confirmed_subsidies">, "id" | "created_at" | "updated_at" | "created_by">,
    ) => addConfirmedSubsidy(ligne),
    onSuccess: invalider,
  });
  const retirer = useMutation({
    mutationFn: (id: string) => removeConfirmedSubsidy(id),
    onSuccess: invalider,
  });

  const confirmeesParVehicule = useMemo(
    (): Map<string, SubventionConfirmee[]> => parVehicule(query.data ?? []),
    [query.data],
  );

  return {
    lignes: (query.data ?? []) as ConfirmedSubsidy[],
    confirmeesParVehicule,
    isLoading: query.isLoading,
    ajouter,
    retirer,
  };
}
