import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if the current user has admin privileges.
 *
 * Source de vérité unique : la fonction SQL has_role (table user_roles),
 * la même que celle utilisée par les politiques RLS côté serveur.
 * (L'ancienne liste d'emails côté client a été supprimée.)
 *
 * SECURITY NOTE: This is for UI display purposes only.
 * All sensitive admin operations must be validated server-side.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, isLoading: authLoading } = useAuth();

  const { data: isAdmin = false, isLoading: roleLoading } = useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user!.id,
        _role: 'admin',
      });
      if (error) {
        console.error('has_role check failed:', error.message);
        return false;
      }
      return data === true;
    },
  });

  return { isAdmin, isLoading: authLoading || (!!user && roleLoading) };
}
