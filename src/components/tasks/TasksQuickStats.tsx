import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTasks } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react';

interface TasksQuickStatsProps {
  projectId: string;
}

export function TasksQuickStats({ projectId }: TasksQuickStatsProps) {
  const { t } = useTranslation();
  const { stats, isLoading } = useTasks(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-6">
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <div>
          <div className="text-2xl font-bold">
            {stats.completed}/{stats.total}
          </div>
          <div className="text-xs text-muted-foreground">{t('tasks.stats.completed', 'Completed')}</div>
        </div>
      </div>

      {stats.overdue > 0 && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          {stats.overdue} {t('tasks.overdue', 'overdue')}
        </Badge>
      )}

      {stats.overBudget > 0 && (
        <Badge variant="outline" className="gap-1 border-orange-500 text-orange-600">
          <DollarSign className="w-3 h-3" />
          {stats.overBudget} {t('tasks.overBudget', 'over budget')}
        </Badge>
      )}

      {stats.total === 0 && (
        <span className="text-sm text-muted-foreground">
          {t('tasks.noTasksYet', 'No tasks yet')}
        </span>
      )}
    </div>
  );
}
