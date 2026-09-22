import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// Types
export interface Roadmap {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  total_budget: number | null;
  currency: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  version: number;
  generated_automatically: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Phase {
  id: string;
  roadmap_id: string;
  name: string;
  description: string | null;
  order_index: number;
  color: string | null;
  start_date: string;
  end_date: string;
  budget_allocated: number | null;
  budget_spent: number | null;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  completion_percentage: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  phase_id: string;
  type: 'vehicle_purchase' | 'infrastructure_install' | 'permit_application' | 'training' | 'subsidy_application' | 'inspection' | 'custom';
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string;
  completion_date: string | null;
  duration_days: number;
  is_critical: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  cost_estimate: number | null;
  cost_actual: number | null;
  dependencies: string[];
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  progress_percentage: number;
  assigned_to: string | null;
  assigned_team: string | null;
  metadata: Record<string, unknown> | null;
  alert_days_before: number | null;
  alert_sent: boolean;
  created_at: string;
  updated_at: string;
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface CreateRoadmapInput {
  project_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  total_budget?: number;
  currency?: string;
}

export interface CreatePhaseInput {
  roadmap_id: string;
  name: string;
  description?: string;
  order_index: number;
  color?: string;
  start_date: string;
  end_date: string;
  budget_allocated?: number;
}

export interface CreateMilestoneInput {
  phase_id: string;
  type: Milestone['type'];
  title: string;
  description?: string;
  start_date?: string;
  due_date: string;
  duration_days?: number;
  is_critical?: boolean;
  priority?: Milestone['priority'];
  status?: Milestone['status'];
  cost_estimate?: number;
  dependencies?: string[];
  assigned_to?: string;
  assigned_team?: string;
  alert_days_before?: number;
  metadata?: Record<string, unknown>;
}

// Hook for fetching roadmaps by project
export function useProjectRoadmaps(projectId: string | undefined) {
  return useQuery({
    queryKey: ['roadmaps', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('transition_roadmaps')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Roadmap[];
    },
    enabled: !!projectId,
  });
}

// Hook for single roadmap with phases and milestones
export function useRoadmap(roadmapId: string | undefined) {
  const roadmapQuery = useQuery({
    queryKey: ['roadmap', roadmapId],
    queryFn: async () => {
      if (!roadmapId) return null;
      const { data, error } = await supabase
        .from('transition_roadmaps')
        .select('*')
        .eq('id', roadmapId)
        .single();
      
      if (error) throw error;
      return data as Roadmap;
    },
    enabled: !!roadmapId,
  });

  const phasesQuery = useQuery({
    queryKey: ['roadmap-phases', roadmapId],
    queryFn: async () => {
      if (!roadmapId) return [];
      const { data, error } = await supabase
        .from('roadmap_phases')
        .select('*')
        .eq('roadmap_id', roadmapId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as Phase[];
    },
    enabled: !!roadmapId,
  });

  const milestonesQuery = useQuery({
    queryKey: ['roadmap-milestones', roadmapId],
    queryFn: async () => {
      if (!roadmapId) return [];
      const phaseIds = phasesQuery.data?.map(p => p.id) || [];
      if (phaseIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('roadmap_milestones')
        .select('*')
        .in('phase_id', phaseIds)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data as Milestone[];
    },
    enabled: !!roadmapId && !!phasesQuery.data?.length,
  });

  return {
    roadmap: roadmapQuery.data,
    phases: phasesQuery.data || [],
    milestones: milestonesQuery.data || [],
    isLoading: roadmapQuery.isLoading || phasesQuery.isLoading,
    error: roadmapQuery.error || phasesQuery.error,
  };
}

// Mutations
export function useRoadmapMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createRoadmap = useMutation({
    mutationFn: async (input: CreateRoadmapInput) => {
      const { data, error } = await supabase
        .from('transition_roadmaps')
        .insert({
          ...input,
          created_by: user?.id,
          updated_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Roadmap;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps', data.project_id] });
      toast({ title: 'Roadmap créé', description: `"${data.name}" a été créé avec succès.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateRoadmap = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Roadmap> & { id: string }) => {
      const { data, error } = await supabase
        .from('transition_roadmaps')
        .update({ ...updates, updated_by: user?.id })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Roadmap;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', data.id] });
      queryClient.invalidateQueries({ queryKey: ['roadmaps', data.project_id] });
    },
  });

  const deleteRoadmap = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transition_roadmaps')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] });
      toast({ title: 'Roadmap supprimé' });
    },
  });

  const createPhase = useMutation({
    mutationFn: async (input: CreatePhaseInput) => {
      const { data, error } = await supabase
        .from('roadmap_phases')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data as Phase;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-phases', data.roadmap_id] });
      toast({ title: 'Phase créée', description: `"${data.name}" a été ajoutée.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updatePhase = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Phase> & { id: string }) => {
      const { metadata, ...rest } = updates;
      const { data, error } = await supabase
        .from('roadmap_phases')
        .update({ ...rest, metadata: metadata as Json })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Phase;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-phases', data.roadmap_id] });
    },
  });

  const deletePhase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('roadmap_phases')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-phases'] });
      toast({ title: 'Phase supprimée' });
    },
  });

  const createMilestone = useMutation({
    mutationFn: async (input: CreateMilestoneInput) => {
      const { metadata, dependencies, ...rest } = input;
      const { data, error } = await supabase
        .from('roadmap_milestones')
        .insert({ 
          ...rest, 
          metadata: (metadata || {}) as Json,
          dependencies: (dependencies || []) as Json,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Milestone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-milestones'] });
      toast({ title: 'Jalon créé' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Milestone> & { id: string }) => {
      const { metadata, dependencies, ...rest } = updates;
      const { data, error } = await supabase
        .from('roadmap_milestones')
        .update({ 
          ...rest, 
          ...(metadata && { metadata: metadata as Json }),
          ...(dependencies && { dependencies: dependencies as Json }),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Milestone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-milestones'] });
    },
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('roadmap_milestones')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap-milestones'] });
      toast({ title: 'Jalon supprimé' });
    },
  });

  return {
    createRoadmap,
    updateRoadmap,
    deleteRoadmap,
    createPhase,
    updatePhase,
    deletePhase,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  };
}

// Helper to calculate critical path
export function calculateCriticalPath(milestones: Milestone[]): string[] {
  // Simple critical path: milestones marked as critical or with dependencies chain
  const criticalIds = new Set<string>();
  
  milestones.forEach(m => {
    if (m.is_critical) {
      criticalIds.add(m.id);
      // Add all dependencies
      m.dependencies.forEach(depId => criticalIds.add(depId));
    }
  });
  
  return Array.from(criticalIds);
}

// Helper to get milestone status color
export function getMilestoneStatusColor(status: Milestone['status']): string {
  switch (status) {
    case 'completed': return 'hsl(var(--accent))';
    case 'in_progress': return 'hsl(var(--primary))';
    case 'blocked': return 'hsl(var(--destructive))';
    case 'cancelled': return 'hsl(var(--muted-foreground))';
    default: return 'hsl(var(--secondary))';
  }
}

// Helper to get priority color
export function getPriorityColor(priority: Milestone['priority']): string {
  switch (priority) {
    case 'urgent': return 'hsl(0 84% 60%)';
    case 'high': return 'hsl(25 95% 53%)';
    case 'medium': return 'hsl(45 93% 47%)';
    default: return 'hsl(var(--muted-foreground))';
  }
}
