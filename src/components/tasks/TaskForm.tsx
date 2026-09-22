import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Task, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/types/project-management';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarIcon, Loader2, Users, Milestone as MilestoneIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn, getDateLocale } from '@/lib/utils';
import { useProjectCollaborators } from '@/hooks/useProjectCollaborators';
import { useProjectRoadmaps, useRoadmap } from '@/hooks/useRoadmap';

interface TaskFormProps {
  task?: Task;
  projectId: string;
  milestoneId?: string;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TaskForm({ task, projectId, milestoneId: initialMilestoneId, onSubmit, onCancel, isLoading }: TaskFormProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);

  const taskSchema = z.object({
    title: z.string().min(1, t('tasks.form.titleRequired', 'Title is required')),
    description: z.string().optional(),
    status: z.enum(['todo', 'in_progress', 'blocked', 'completed']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    budgetAllocated: z.number().min(0).optional(),
    budgetSpent: z.number().min(0).optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
  });

  type TaskFormData = z.infer<typeof taskSchema>;

  const [startDate, setStartDate] = useState<Date | undefined>(
    task?.startDate ? new Date(task.startDate) : undefined
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task?.dueDate ? new Date(task.dueDate) : undefined
  );
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(task?.assignedTo || []);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | undefined>(task?.milestoneId || initialMilestoneId);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | undefined>(undefined);

  // Fetch collaborators for the project
  const { collaborators } = useProjectCollaborators(projectId);
  
  // Fetch roadmaps for the project
  const { data: roadmaps = [] } = useProjectRoadmaps(projectId);
  
  // Fetch milestones for the selected roadmap
  const { milestones } = useRoadmap(selectedRoadmapId);

  // Auto-select first roadmap if available
  useEffect(() => {
    if (roadmaps.length > 0 && !selectedRoadmapId) {
      setSelectedRoadmapId(roadmaps[0].id);
    }
  }, [roadmaps, selectedRoadmapId]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      status: task?.status || 'todo',
      priority: task?.priority || 'medium',
      budgetAllocated: task?.budgetAllocated || 0,
      budgetSpent: task?.budgetSpent || 0,
      startDate: task?.startDate || '',
      dueDate: task?.dueDate || '',
    },
  });

  const currentStatus = watch('status');
  const currentPriority = watch('priority');

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const onFormSubmit = async (data: TaskFormData) => {
    if (task) {
      // Update
      await onSubmit({
        title: data.title,
        description: data.description,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        budgetAllocated: data.budgetAllocated,
        budgetSpent: data.budgetSpent,
        startDate: startDate?.toISOString().split('T')[0],
        dueDate: dueDate?.toISOString().split('T')[0],
        assignedTo: selectedAssignees,
        milestoneId: selectedMilestoneId || null,
      });
    } else {
      // Create
      await onSubmit({
        projectId,
        milestoneId: selectedMilestoneId,
        title: data.title,
        description: data.description,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        budgetAllocated: data.budgetAllocated,
        startDate: startDate?.toISOString().split('T')[0],
        dueDate: dueDate?.toISOString().split('T')[0],
        assignedTo: selectedAssignees,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">{t('tasks.form.titleLabel', 'Title')} *</Label>
        <Input
          id="title"
          placeholder={t('tasks.form.titlePlaceholder', 'Task name')}
          {...register('title')}
          className={errors.title ? 'border-red-500' : ''}
        />
        {errors.title && (
          <p className="text-sm text-red-500">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">{t('tasks.form.description', 'Description')}</Label>
        <Textarea
          id="description"
          placeholder={t('tasks.form.descriptionPlaceholder', 'Task details...')}
          rows={3}
          {...register('description')}
        />
      </div>

      {/* Status & Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('tasks.form.status', 'Status')}</Label>
          <Select
            value={currentStatus}
            onValueChange={(value) => setValue('status', value as TaskStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {t(config.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('tasks.form.priority', 'Priority')}</Label>
          <Select
            value={currentPriority}
            onValueChange={(value) => setValue('priority', value as TaskPriority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_PRIORITY_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.icon} {t(config.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignees */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          {t('tasks.form.assignees', 'Assignees')}
        </Label>
        {collaborators.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {collaborators.map((collab) => (
              <button
                type="button"
                key={collab.userId}
                onClick={() => toggleAssignee(collab.userId)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors',
                  selectedAssignees.includes(collab.userId)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                )}
              >
                <Avatar className="w-5 h-5">
                  <AvatarImage src={collab.profile?.avatarUrl || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {collab.profile?.fullName?.split(' ').map(n => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{collab.profile?.fullName || t('tasks.form.user', 'User')}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('tasks.form.noCollaborators', 'No collaborators on this project')}
          </p>
        )}
      </div>

      {/* Milestone Selection */}
      {roadmaps.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MilestoneIcon className="w-4 h-4" />
            {t('tasks.form.linkMilestone', 'Link to milestone (optional)')}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={selectedRoadmapId} onValueChange={setSelectedRoadmapId}>
              <SelectTrigger>
                <SelectValue placeholder={t('tasks.form.roadmap', 'Roadmap')} />
              </SelectTrigger>
              <SelectContent>
                {roadmaps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={selectedMilestoneId || ''} 
              onValueChange={(v) => setSelectedMilestoneId(v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('tasks.form.milestone', 'Milestone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('tasks.form.none', 'None')}</SelectItem>
                {milestones.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('tasks.form.startDate', 'Start date')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'dd MMM yyyy', { locale: dateLocale }) : t('tasks.form.select', 'Select')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                locale={dateLocale}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>{t('tasks.form.dueDate', 'Due date')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dueDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, 'dd MMM yyyy', { locale: dateLocale }) : t('tasks.form.select', 'Select')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={setDueDate}
                locale={dateLocale}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Budget */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="budgetAllocated">{t('tasks.form.budgetAllocated', 'Budget allocated ($)')}</Label>
          <Input
            id="budgetAllocated"
            type="number"
            min={0}
            step={100}
            {...register('budgetAllocated', { valueAsNumber: true })}
          />
        </div>

        {task && (
          <div className="space-y-2">
            <Label htmlFor="budgetSpent">{t('tasks.form.budgetSpent', 'Budget spent ($)')}</Label>
            <Input
              id="budgetSpent"
              type="number"
              min={0}
              step={100}
              {...register('budgetSpent', { valueAsNumber: true })}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('tasks.form.cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {task ? t('tasks.form.save', 'Save') : t('tasks.form.create', 'Create')}
        </Button>
      </div>
    </form>
  );
}
