import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserObjectives {
  id: string;
  user_id: string;
  target_zev_percent: number;
  target_year: number;
  target_co2_reduction: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_OBJECTIVES: Omit<UserObjectives, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  target_zev_percent: 50,
  target_year: 2030,
  target_co2_reduction: 50,
};

export function useUserObjectives() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: objectives, isLoading, error, refetch } = useQuery({
    queryKey: ['user-objectives', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_objectives')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      return data as UserObjectives | null;
    },
    enabled: !!user?.id,
  });

  const updateObjectivesMutation = useMutation({
    mutationFn: async (newObjectives: Partial<Omit<UserObjectives, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user?.id) throw new Error('No user');

      const { data, error } = await supabase
        .from('user_objectives')
        .upsert({
          user_id: user.id,
          ...DEFAULT_OBJECTIVES,
          ...objectives,
          ...newObjectives,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-objectives', user?.id] });
    },
  });

  const updateObjectives = (newObjectives: Partial<Omit<UserObjectives, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    return updateObjectivesMutation.mutateAsync(newObjectives);
  };

  return {
    objectives: objectives || {
      ...DEFAULT_OBJECTIVES,
      id: '',
      user_id: user?.id || '',
      created_at: '',
      updated_at: '',
    } as UserObjectives,
    isLoading,
    error,
    updateObjectives,
    isUpdating: updateObjectivesMutation.isPending,
    refetch,
    hasCustomObjectives: !!objectives,
  };
}
