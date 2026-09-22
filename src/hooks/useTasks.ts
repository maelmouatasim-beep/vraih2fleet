import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Task, 
  TaskRow, 
  TaskStatus, 
  CreateTaskInput, 
  UpdateTaskInput,
  rowToTask,
  UserProfile
} from '@/types/project-management';

export function useTasks(projectId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Fetch all tasks for a project
  const fetchTasks = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      const tasksData = (data || []).map((row: TaskRow) => rowToTask(row));
      
      // Fetch assignee profiles
      const allUserIds = [...new Set(tasksData.flatMap(t => t.assignedTo))];
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', allUserIds);
        
        const profileMap = new Map<string, UserProfile>();
        (profiles || []).forEach(p => {
          profileMap.set(p.id, { 
            id: p.id, 
            fullName: p.full_name, 
            avatarUrl: p.avatar_url 
          });
        });

        tasksData.forEach(task => {
          task.assignees = task.assignedTo
            .map(id => profileMap.get(id))
            .filter((p): p is UserProfile => p !== undefined);
        });
      }

      // Fetch comment counts for all tasks
      const taskIds = tasksData.map(t => t.id);
      if (taskIds.length > 0) {
        const { data: comments } = await supabase
          .from('task_comments')
          .select('task_id')
          .in('task_id', taskIds);
        
        const commentCountMap = new Map<string, number>();
        (comments || []).forEach(c => {
          commentCountMap.set(c.task_id, (commentCountMap.get(c.task_id) || 0) + 1);
        });

        tasksData.forEach(task => {
          task.commentsCount = commentCountMap.get(task.id) || 0;
        });
      }

      // Fetch attachment counts for all tasks
      if (taskIds.length > 0) {
        const { data: attachments } = await supabase
          .from('task_attachments')
          .select('task_id')
          .in('task_id', taskIds);
        
        const attachmentCountMap = new Map<string, number>();
        (attachments || []).forEach(a => {
          attachmentCountMap.set(a.task_id, (attachmentCountMap.get(a.task_id) || 0) + 1);
        });

        tasksData.forEach(task => {
          task.attachmentsCount = attachmentCountMap.get(task.id) || 0;
        });
      }

      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!projectId) return;

    fetchTasks();

    const channel = supabase
      .channel(`tasks-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchTasks]);

  // Create a new task
  const createTask = async (input: CreateTaskInput): Promise<Task | null> => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return null;
    }

    try {
      // Get max order_index for the status
      const { data: maxOrderData } = await supabase
        .from('tasks')
        .select('order_index')
        .eq('project_id', input.projectId)
        .eq('status', input.status || 'todo')
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrder = (maxOrderData?.[0]?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: input.projectId,
          milestone_id: input.milestoneId || null,
          title: input.title,
          description: input.description || null,
          status: input.status || 'todo',
          priority: input.priority || 'medium',
          budget_allocated: input.budgetAllocated || 0,
          start_date: input.startDate || null,
          due_date: input.dueDate || null,
          assigned_to: input.assignedTo || [],
          depends_on: input.dependsOn || [],
          order_index: nextOrder,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Tâche créée');
      return rowToTask(data);
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Erreur lors de la création de la tâche');
      return null;
    }
  };

  // Update a task
  const updateTask = async (taskId: string, updates: UpdateTaskInput): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = {};
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.budgetAllocated !== undefined) updateData.budget_allocated = updates.budgetAllocated;
      if (updates.budgetSpent !== undefined) updateData.budget_spent = updates.budgetSpent;
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
      if (updates.completedDate !== undefined) updateData.completed_date = updates.completedDate;
      if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;
      if (updates.dependsOn !== undefined) updateData.depends_on = updates.dependsOn;
      if (updates.blockedBy !== undefined) updateData.blocked_by = updates.blockedBy;
      if (updates.orderIndex !== undefined) updateData.order_index = updates.orderIndex;
      if (updates.milestoneId !== undefined) updateData.milestone_id = updates.milestoneId;

      // Auto-set completed_date when status changes to completed
      if (updates.status === 'completed' && !updates.completedDate) {
        updateData.completed_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Tâche mise à jour');
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Erreur lors de la mise à jour');
      return false;
    }
  };

  // Delete a task
  const deleteTask = async (taskId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Tâche supprimée');
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  };

  // Move task to different status (for drag & drop)
  const moveTask = async (
    taskId: string, 
    newStatus: TaskStatus, 
    newOrderIndex: number
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus, 
          order_index: newOrderIndex,
          completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null
        })
        .eq('id', taskId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error moving task:', error);
      toast.error('Erreur lors du déplacement');
      return false;
    }
  };

  // Get tasks grouped by status
  const tasksByStatus = tasks.reduce<Record<TaskStatus, Task[]>>(
    (acc, task) => {
      acc[task.status].push(task);
      return acc;
    },
    { todo: [], in_progress: [], blocked: [], completed: [] }
  );

  // Calculate project stats
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.isOverdue).length,
    overBudget: tasks.filter(t => t.isOverBudget).length,
    totalBudget: tasks.reduce((sum, t) => sum + t.budgetAllocated, 0),
    totalSpent: tasks.reduce((sum, t) => sum + t.budgetSpent, 0),
  };

  return {
    tasks,
    tasksByStatus,
    stats,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    refetch: fetchTasks,
  };
}

// Hook for a single task with comments
export function useTask(taskId: string | undefined) {
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setIsLoading(false);
      return;
    }

    const fetchTask = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (error) throw error;
        setTask(rowToTask(data));
      } catch (error) {
        console.error('Error fetching task:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  return { task, isLoading };
}

// Hook to get tasks for a specific milestone
export function useMilestoneTasks(milestoneId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!milestoneId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('milestone_id', milestoneId)
          .order('order_index', { ascending: true });

        if (error) throw error;
        setTasks((data || []).map(rowToTask));
      } catch (error) {
        console.error('Error fetching milestone tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [milestoneId]);

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;

  return { tasks, isLoading, completed, total };
}
