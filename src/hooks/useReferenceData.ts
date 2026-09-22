import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ReferenceDataRange, 
  ReferenceCategory, 
  ReferenceDataStats 
} from '@/types/referenceData';
import { toast } from '@/hooks/use-toast';

export function useReferenceData(category?: ReferenceCategory) {
  return useQuery({
    queryKey: ['reference-data', category],
    queryFn: async () => {
      let query = supabase
        .from('reference_data_ranges')
        .select('*')
        .order('category', { ascending: true })
        .order('region', { ascending: true });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ReferenceDataRange[];
    },
  });
}

export function useReferenceDataStats() {
  return useQuery({
    queryKey: ['reference-data-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_data_ranges')
        .select('category, region, last_updated');
      
      if (error) throw error;
      
      const stats: ReferenceDataStats = {
        totalRecords: data.length,
        categoryCounts: {
          fuel_prices: 0,
          electricity: 0,
          hydrogen: 0,
          vehicles: 0,
          co2_factors: 0,
        },
        regionCount: new Set(data.map(d => d.region)).size,
        lastUpdated: data.length > 0 
          ? data.reduce((latest, item) => 
              new Date(item.last_updated) > new Date(latest) ? item.last_updated : latest, 
              data[0].last_updated
            )
          : null,
      };
      
      data.forEach(item => {
        const cat = item.category as ReferenceCategory;
        if (stats.categoryCounts[cat] !== undefined) {
          stats.categoryCounts[cat]++;
        }
      });
      
      return stats;
    },
  });
}

export function useUpdateReferenceData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<ReferenceDataRange> & { id: string }) => {
      const { id, ...updateData } = data;
      
      const { data: result, error } = await supabase
        .from('reference_data_ranges')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data-stats'] });
      toast({
        title: 'Success',
        description: 'Reference data updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useCreateReferenceData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<ReferenceDataRange, 'id' | 'created_at' | 'last_updated'>) => {
      const { data: result, error } = await supabase
        .from('reference_data_ranges')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data-stats'] });
      toast({
        title: 'Success',
        description: 'Reference data created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteReferenceData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reference_data_ranges')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data-stats'] });
      toast({
        title: 'Success',
        description: 'Reference data deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
