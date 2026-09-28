import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getMyOrganization } from "@/lib/supabase/organizations";

/** Organisation courante de l'utilisateur (créée automatiquement à
 *  l'inscription — voir migration 20260928150000_organizations). */
export function useOrganization() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["organization", user?.id],
    queryFn: () => getMyOrganization(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  return {
    organization: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
