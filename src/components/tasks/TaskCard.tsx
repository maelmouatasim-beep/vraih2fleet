import React from 'react';
import { useTranslation } from 'react-i18next';
import { formateurCadCompact } from '@/lib/format';
import { Task, TASK_PRIORITY_CONFIG } from '@/types/project-management';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, AlertTriangle, DollarSign, MessageSquare, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { cn, getDateLocale } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const { t, i18n } = useTranslation();
  const priorityConfig = TASK_PRIORITY_CONFIG[task.priority];
  const budgetPercent = task.budgetAllocated > 0 
    ? Math.round((task.budgetSpent / task.budgetAllocated) * 100) 
    : 0;
  const dateLocale = getDateLocale(i18n.language);

  // Audit acheteur, point 10 : format de la langue (« 12 k$ », « 0 $ »).
  const formatCurrency = (amount: number) => formateurCadCompact(i18n.language).format(amount);

  return (
    <Card
      className={cn(
        'p-3 cursor-pointer hover:shadow-md transition-all border-l-4',
        isDragging && 'opacity-50 rotate-2 shadow-lg',
        task.isOverdue && 'border-l-red-500',
        task.isOverBudget && !task.isOverdue && 'border-l-orange-500',
        !task.isOverdue && !task.isOverBudget && 'border-l-transparent'
      )}
      onClick={onClick}
    >
      {/* Header with title and priority */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
        <span className={cn('text-xs font-bold', priorityConfig.color)}>
          {priorityConfig.icon}
        </span>
      </div>

      {/* Alerts */}
      {(task.isOverdue || task.isOverBudget) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.isOverdue && (
            <Badge variant="destructive" className="text-xs py-0">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {t('tasks.overdue', 'Overdue')}
            </Badge>
          )}
          {task.isOverBudget && (
            <Badge variant="outline" className="text-xs py-0 border-orange-500 text-orange-500">
              <DollarSign className="w-3 h-3 mr-1" />
              {t('tasks.overBudget', 'Over budget')}
            </Badge>
          )}
        </div>
      )}

      {/* Budget indicator */}
      {task.budgetAllocated > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{formatCurrency(task.budgetSpent)} / {formatCurrency(task.budgetAllocated)}</span>
            <span className={cn(
              budgetPercent > 100 && 'text-red-500 font-medium',
              budgetPercent > 80 && budgetPercent <= 100 && 'text-orange-500'
            )}>
              {budgetPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                budgetPercent > 100 && 'bg-red-500',
                budgetPercent > 80 && budgetPercent <= 100 && 'bg-orange-500',
                budgetPercent <= 80 && 'bg-green-500'
              )}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Due date */}
      {task.dueDate && (
        <div className={cn(
          'flex items-center gap-1 text-xs mb-2',
          task.isOverdue ? 'text-red-500' : 'text-muted-foreground'
        )}>
          <Calendar className="w-3 h-3" />
          <span>{format(new Date(task.dueDate), 'd MMM yyyy', { locale: dateLocale })}</span>
        </div>
      )}

      {/* Footer: Assignees and meta */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        {/* Assignees */}
        <div className="flex -space-x-2">
          {task.assignees?.slice(0, 3).map((assignee) => (
            <Avatar key={assignee.id} className="w-6 h-6 border-2 border-background">
              <AvatarImage src={assignee.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px]">
                {assignee.fullName?.split(' ').map(n => n[0]).join('') || '?'}
              </AvatarFallback>
            </Avatar>
          ))}
          {(task.assignees?.length || 0) > 3 && (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border-2 border-background">
              +{task.assignees!.length - 3}
            </div>
          )}
        </div>

        {/* Comments & attachments count */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(task.commentsCount || 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3" />
              {task.commentsCount}
            </span>
          )}
          {(task.attachmentsCount || 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="w-3 h-3" />
              {task.attachmentsCount}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
