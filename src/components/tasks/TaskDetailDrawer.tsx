import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, UpdateTaskInput, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/types/project-management';
import { useTaskComments } from '@/hooks/useTaskComments';
import { useProjectCollaborators } from '@/hooks/useProjectCollaborators';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MentionInput } from './MentionInput';
import { CommentWithMentions } from './CommentWithMentions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Calendar, 
  DollarSign, 
  Users, 
  MessageSquare, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  Send,
  Loader2,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn, getDateLocale } from '@/lib/utils';
import { TaskForm } from './TaskForm';

interface TaskDetailDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (data: UpdateTaskInput) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskDetailDrawer({ task, isOpen, onClose, onUpdate, onDelete }: TaskDetailDrawerProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  const { comments, isLoading: commentsLoading, addComment } = useTaskComments(task?.id);
  const { collaborators } = useProjectCollaborators(task?.projectId);

  if (!task) return null;

  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const priorityConfig = TASK_PRIORITY_CONFIG[task.priority];
  const budgetPercent = task.budgetAllocated > 0 
    ? Math.round((task.budgetSpent / task.budgetAllocated) * 100) 
    : 0;

  const handleUpdate = async (data: UpdateTaskInput) => {
    setIsSubmitting(true);
    await onUpdate(data);
    setIsSubmitting(false);
    setIsEditing(false);
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    
    setIsSendingComment(true);
    const collaboratorProfiles = collaborators.map(c => ({
      id: c.userId,
      fullName: c.profile?.fullName || null,
      avatarUrl: c.profile?.avatarUrl || null,
    }));
    
    const success = await addComment(newComment, collaboratorProfiles);
    if (success) {
      setNewComment('');
    }
    setIsSendingComment(false);
  };

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'fr' ? 'fr-CA' : 'en-CA';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <Sheet open={isOpen} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-left pr-8">{task.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
                  {t(statusConfig.labelKey)}
                </Badge>
                <Badge variant="outline" className={cn('text-xs', priorityConfig.color)}>
                  {priorityConfig.icon} {t(priorityConfig.labelKey)}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('tasks.detail.deleteTitle', 'Delete this task?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('tasks.detail.deleteDescription', 'This action is irreversible. All comments and attachments will also be deleted.')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('tasks.detail.cancel', 'Cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                      {t('tasks.detail.delete', 'Delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetHeader>

        {isEditing ? (
          <div className="p-4 flex-1 overflow-auto">
            <TaskForm
              task={task}
              projectId={task.projectId}
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
              isLoading={isSubmitting}
            />
          </div>
        ) : (
          <Tabs defaultValue="details" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-2">
              <TabsTrigger value="details">{t('tasks.detail.details', 'Details')}</TabsTrigger>
              <TabsTrigger value="comments" className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {comments.length > 0 && <span>({comments.length})</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 p-4 overflow-auto m-0">
              <div className="space-y-6">
                {/* Alerts */}
                {(task.isOverdue || task.isOverBudget) && (
                  <div className="space-y-2">
                    {task.isOverdue && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('tasks.detail.taskOverdue', 'Task overdue')}</span>
                      </div>
                    )}
                    {task.isOverBudget && (
                      <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-600">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('tasks.detail.budgetExceeded', 'Budget exceeded by')} {budgetPercent - 100}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {task.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('tasks.form.description', 'Description')}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {t('tasks.detail.timeline', 'Timeline')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('tasks.detail.start', 'Start:')}</span>
                      <p className="font-medium">
                        {task.startDate 
                          ? format(new Date(task.startDate), 'd MMMM yyyy', { locale: dateLocale })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('tasks.detail.deadline', 'Deadline:')}</span>
                      <p className={cn('font-medium', task.isOverdue && 'text-red-500')}>
                        {task.dueDate 
                          ? format(new Date(task.dueDate), 'd MMMM yyyy', { locale: dateLocale })
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    {t('tasks.detail.budget', 'Budget')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('tasks.detail.allocated', 'Allocated:')}</span>
                      <span className="font-medium">{formatCurrency(task.budgetAllocated)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('tasks.detail.spent', 'Spent:')}</span>
                      <span className={cn('font-medium', task.isOverBudget && 'text-red-500')}>
                        {formatCurrency(task.budgetSpent)}
                      </span>
                    </div>
                    {task.budgetAllocated > 0 && (
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                    )}
                  </div>
                </div>

                {/* Assignees */}
                {task.assignees && task.assignees.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {t('tasks.detail.assignees', 'Assignees')}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {task.assignees.map((assignee) => (
                        <div key={assignee.id} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={assignee.avatarUrl || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {assignee.fullName?.split(' ').map(n => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{assignee.fullName || t('tasks.detail.user', 'User')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-muted-foreground border-t pt-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t('tasks.detail.created', 'Created')} {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: dateLocale })}
                  </div>
                  {task.updatedAt !== task.createdAt && (
                    <div className="mt-1">
                      {t('tasks.detail.modified', 'Modified')} {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true, locale: dateLocale })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comments" className="flex-1 flex flex-col p-0 m-0">
              {/* Comments list */}
              <ScrollArea className="flex-1 p-4">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('tasks.detail.noComments', 'No comments')}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={comment.user?.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {comment.user?.fullName?.split(' ').map(n => n[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {comment.user?.fullName || t('tasks.detail.user', 'User')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: dateLocale })}
                            </span>
                          </div>
                          <CommentWithMentions content={comment.content} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Comment input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <MentionInput
                    value={newComment}
                    onChange={setNewComment}
                    collaborators={collaborators.map(c => ({
                      id: c.userId,
                      fullName: c.profile?.fullName || null,
                      avatarUrl: c.profile?.avatarUrl || null,
                    }))}
                    placeholder={t('tasks.detail.addComment', 'Add a comment... (use @ to mention)')}
                    rows={2}
                    disabled={isSendingComment}
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendComment}
                    disabled={!newComment.trim() || isSendingComment}
                  >
                    {isSendingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
