import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface FavoriteSupplier {
  id: string;
  user_id: string;
  supplier_id: string;
  created_at: string;
}

export function useFavoriteSuppliers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_favorite_suppliers')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      setFavorites(data || []);
      setFavoriteIds(new Set((data || []).map(f => f.supplier_id)));
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorite = useCallback(async (supplierId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_favorite_suppliers')
        .insert({ user_id: user.id, supplier_id: supplierId });

      if (error) throw error;

      setFavoriteIds(prev => new Set([...prev, supplierId]));
      await fetchFavorites();
      toast.success(t('suppliers.favorites.addedToast'));
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      return false;
    }
  }, [user, fetchFavorites, t]);

  const removeFavorite = useCallback(async (supplierId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_favorite_suppliers')
        .delete()
        .eq('user_id', user.id)
        .eq('supplier_id', supplierId);

      if (error) throw error;

      setFavoriteIds(prev => {
        const next = new Set(prev);
        next.delete(supplierId);
        return next;
      });
      await fetchFavorites();
      toast.success(t('suppliers.favorites.removedToast'));
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      return false;
    }
  }, [user, fetchFavorites, t]);

  const toggleFavorite = useCallback(async (supplierId: string) => {
    if (favoriteIds.has(supplierId)) {
      return removeFavorite(supplierId);
    } else {
      return addFavorite(supplierId);
    }
  }, [favoriteIds, addFavorite, removeFavorite]);

  const isFavorite = useCallback((supplierId: string) => {
    return favoriteIds.has(supplierId);
  }, [favoriteIds]);

  return {
    favorites,
    favoriteIds,
    loading,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
}
