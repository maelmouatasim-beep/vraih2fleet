import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MilestoneTaskCount {
  milestoneId: string;
  count: number;
  completed: number;
}

export function useMilestoneTaskCounts(milestoneIds: string[]) {
  const [counts, setCounts] = useState<Map<string, MilestoneTaskCount>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!milestoneIds || milestoneIds.length === 0) {
      setCounts(new Map());
      return;
    }

    const fetchCounts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('milestone_id, status')
          .in('milestone_id', milestoneIds);

        if (error) throw error;

        const countMap = new Map<string, MilestoneTaskCount>();
        
        // Initialize all milestones with 0
        milestoneIds.forEach(id => {
          countMap.set(id, { milestoneId: id, count: 0, completed: 0 });
        });

        // Count tasks
        (data || []).forEach(task => {
          if (task.milestone_id) {
            const existing = countMap.get(task.milestone_id);
            if (existing) {
              existing.count += 1;
              if (task.status === 'completed') {
                existing.completed += 1;
              }
            }
          }
        });

        setCounts(countMap);
      } catch (error) {
        console.error('Error fetching milestone task counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, [milestoneIds.join(',')]);

  const getCount = (milestoneId: string) => counts.get(milestoneId) || { milestoneId, count: 0, completed: 0 };

  return { counts, getCount, isLoading };
}
