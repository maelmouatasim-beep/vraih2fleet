import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { isAdminEmail } from '@/lib/constants';

/**
 * Hook to check if the current user has admin privileges
 * Based on email whitelist (client-side check for UI visibility only)
 * 
 * SECURITY NOTE: This is for UI display purposes only.
 * All sensitive admin operations must be validated server-side.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, isLoading } = useAuth();

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    return isAdminEmail(user.email);
  }, [user?.email]);

  return { isAdmin, isLoading };
}
