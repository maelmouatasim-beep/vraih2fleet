import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  getMyOrganization,
  listMyOrganizations,
  setCurrentOrganization,
} from "@/lib/supabase/organizations";

/** Organisation COURANTE de l'utilisateur (celle qu'il a choisie —
 *  revue B5 — sinon la première par date d'adhésion, ordre
 *  déterministe), plus la liste de ses organisations et le sélecteur. */
export function useOrganization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["organization", user?.id],
    queryFn: () => getMyOrganization(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const liste = useQuery({
    queryKey: ["organizations", user?.id],
    queryFn: () => listMyOrganizations(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const changerOrganisation = useMutation({
    mutationFn: (organizationId: string) => setCurrentOrganization(user!.id, organizationId),
    onSuccess: () => {
      // tout dépend de l'organisation courante : on invalide large
      queryClient.invalidateQueries();
    },
  });

  return {
    organization: query.data ?? null,
    organizations: liste.data ?? [],
    changerOrganisation,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
