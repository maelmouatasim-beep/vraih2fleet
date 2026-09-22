import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Milestone, CreateMilestoneInput, Phase } from '@/hooks/useRoadmap';
import { useProjectCollaborators, Collaborator } from '@/hooks/useProjectCollaborators';
import { Truck, Zap, FileText, GraduationCap, Banknote, ClipboardCheck, Settings, Users, CheckCircle2, Clock, PlayCircle, Ban, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const MILESTONE_TYPES = [
  { value: 'vehicle_purchase', icon: Truck, labelKey: 'roadmap.milestone.types.vehiclePurchase' },
  { value: 'infrastructure_install', icon: Zap, labelKey: 'roadmap.milestone.types.infrastructure' },
  { value: 'permit_application', icon: FileText, labelKey: 'roadmap.milestone.types.permit' },
  { value: 'training', icon: GraduationCap, labelKey: 'roadmap.milestone.types.training' },
  { value: 'subsidy_application', icon: Banknote, labelKey: 'roadmap.milestone.types.subsidy' },
  { value: 'inspection', icon: ClipboardCheck, labelKey: 'roadmap.milestone.types.inspection' },
  { value: 'custom', icon: Settings, labelKey: 'roadmap.milestone.types.custom' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low', labelKey: 'roadmap.milestone.priority.low' },
  { value: 'medium', labelKey: 'roadmap.milestone.priority.medium' },
  { value: 'high', labelKey: 'roadmap.milestone.priority.high' },
  { value: 'urgent', labelKey: 'roadmap.milestone.priority.urgent' },
] as const;

const STATUS_OPTIONS = [
  { value: 'not_started', icon: Clock, labelKey: 'roadmap.milestone.status.notStarted', color: 'text-muted-foreground' },
  { value: 'in_progress', icon: PlayCircle, labelKey: 'roadmap.milestone.status.inProgress', color: 'text-blue-500' },
  { value: 'completed', icon: CheckCircle2, labelKey: 'roadmap.milestone.status.completed', color: 'text-green-500' },
  { value: 'blocked', icon: Ban, labelKey: 'roadmap.milestone.status.blocked', color: 'text-red-500' },
  { value: 'cancelled', icon: XCircle, labelKey: 'roadmap.milestone.status.cancelled', color: 'text-muted-foreground' },
] as const;

const TEAM_OPTIONS = [
  { value: 'fleet_operations', labelKey: 'roadmap.teams.fleetOperations' },
  { value: 'facilities', labelKey: 'roadmap.teams.facilities' },
  { value: 'finance', labelKey: 'roadmap.teams.finance' },
  { value: 'procurement', labelKey: 'roadmap.teams.procurement' },
  { value: 'hr_training', labelKey: 'roadmap.teams.hrTraining' },
  { value: 'external', labelKey: 'roadmap.teams.external' },
];

// Helper to get initials from name
const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const milestoneSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  type: z.string().min(1, 'Le type est requis'),
  phase_id: z.string().optional(), // Phase is now optional
  start_date: z.string().optional(),
  due_date: z.string().optional(), // Due date is optional when status is completed
  duration_days: z.number().min(1).optional(),
  priority: z.string().default('medium'),
  status: z.string().default('not_started'),
  is_critical: z.boolean().default(false),
  cost_estimate: z.number().min(0).optional(),
  assigned_team: z.string().optional(),
  alert_days_before: z.number().min(1).optional(),
});

type MilestoneFormData = z.infer<typeof milestoneSchema>;

interface MilestoneFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMilestoneInput) => void;
  phases: Phase[];
  milestone?: Milestone;
  defaultPhaseId?: string;
  isLoading?: boolean;
  projectId?: string;
}

const MilestoneForm: React.FC<MilestoneFormProps> = ({
  open,
  onClose,
  onSubmit,
  phases,
  milestone,
  defaultPhaseId,
  isLoading,
  projectId,
}) => {
  const { t } = useTranslation();
  const { collaborators } = useProjectCollaborators(projectId);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(
    milestone?.assigned_to || null
  );

  // Update selected assignee when milestone changes
  useEffect(() => {
    setSelectedAssignee(milestone?.assigned_to || null);
  }, [milestone]);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<MilestoneFormData>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      title: milestone?.title || '',
      description: milestone?.description || '',
      type: milestone?.type || 'custom',
      phase_id: milestone?.phase_id || defaultPhaseId || '',
      start_date: milestone?.start_date || '',
      due_date: milestone?.due_date || format(new Date(), 'yyyy-MM-dd'),
      duration_days: milestone?.duration_days || 1,
      priority: milestone?.priority || 'medium',
      status: milestone?.status || 'not_started',
      is_critical: milestone?.is_critical || false,
      cost_estimate: milestone?.cost_estimate || undefined,
      assigned_team: milestone?.assigned_team || '',
      alert_days_before: milestone?.alert_days_before || undefined,
    },
  });

  const selectedType = watch('type');
  const isCritical = watch('is_critical');
  const currentStatus = watch('status');

  const handleFormSubmit = (data: MilestoneFormData) => {
    const wasNotCompleted = milestone?.status !== 'completed';
    const isNowCompleted = data.status === 'completed';
    
    // If status is completed and no due_date, use today
    const effectiveDueDate = data.due_date || (isNowCompleted ? format(new Date(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    
    onSubmit({
      phase_id: data.phase_id || phases[0]?.id, // Fallback to first phase if none selected
      type: data.type as Milestone['type'],
      title: data.title,
      description: data.description,
      start_date: data.start_date || undefined,
      due_date: effectiveDueDate,
      duration_days: data.duration_days,
      priority: data.priority as Milestone['priority'],
      status: data.status as Milestone['status'],
      is_critical: data.is_critical,
      cost_estimate: data.cost_estimate,
      assigned_team: data.assigned_team || undefined,
      assigned_to: selectedAssignee || undefined,
      alert_days_before: data.alert_days_before,
    });
    
    // Show celebration toast when marking as completed
    if (wasNotCompleted && isNowCompleted) {
      toast({
        title: t('roadmap.milestone.completedToast', '🎉 Jalon terminé !'),
        description: data.title,
      });
    }
    
    reset();
    setSelectedAssignee(null);
    onClose();
  };

  // Get selected assignee profile
  const selectedAssigneeProfile = collaborators.find(c => c.userId === selectedAssignee);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {milestone 
              ? t('roadmap.milestone.edit', 'Edit Milestone') 
              : t('roadmap.milestone.create', 'Create Milestone')
            }
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>{t('roadmap.milestone.type', 'Type')} *</Label>
            <div className="grid grid-cols-4 gap-2">
              {MILESTONE_TYPES.map(({ value, icon: Icon, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('type', value)}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                    selectedType === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs text-center">{t(labelKey, value)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('roadmap.milestone.title', 'Title')} *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('roadmap.milestone.titlePlaceholder', 'e.g., Order 10 electric vehicles')}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('roadmap.milestone.description', 'Description')}</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('roadmap.milestone.descriptionPlaceholder', 'Additional details...')}
              rows={2}
            />
          </div>

          {/* Phase Selection */}
          <div className="space-y-2">
            <Label>{t('roadmap.milestone.phase', 'Phase')}</Label>
            <Select
              value={watch('phase_id') || ''}
              onValueChange={(value) => setValue('phase_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('roadmap.milestone.selectPhase', 'Sélectionner une phase')} />
              </SelectTrigger>
              <SelectContent>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: phase.color || 'hsl(var(--primary))' }}
                      />
                      {phase.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">{t('roadmap.milestone.startDate', 'Date de début')}</Label>
              <Input
                id="start_date"
                type="date"
                {...register('start_date')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">
                {t('roadmap.milestone.dueDate', "Date d'échéance")}
                {currentStatus !== 'completed' && ' *'}
              </Label>
              <Input
                id="due_date"
                type="date"
                {...register('due_date')}
              />
              {currentStatus !== 'completed' && !watch('due_date') && (
                <p className="text-xs text-muted-foreground">
                  {t('roadmap.milestone.dueDateHint', 'Optionnel si le jalon est terminé')}
                </p>
              )}
            </div>
          </div>

          {/* Status Selection - always show */}
          <div className="space-y-2">
            <Label>{t('roadmap.milestone.statusLabel', 'Statut')}</Label>
            <div className="grid grid-cols-5 gap-2">
              {STATUS_OPTIONS.map(({ value, icon: Icon, labelKey, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('status', value)}
                  className={`p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                    currentStatus === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-xs text-center leading-tight">{t(labelKey, value)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority & Critical */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('roadmap.milestone.priorityLabel', 'Priority')}</Label>
              <Select
                value={watch('priority')}
                onValueChange={(value) => setValue('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(({ value, labelKey }) => (
                    <SelectItem key={value} value={value}>
                      {t(labelKey, value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('roadmap.milestone.criticalPath', 'Critical Path')}</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch
                  checked={isCritical}
                  onCheckedChange={(checked) => setValue('is_critical', checked)}
                />
                <span className="text-sm text-muted-foreground">
                  {isCritical 
                    ? t('roadmap.milestone.onCriticalPath', 'On critical path')
                    : t('roadmap.milestone.notCritical', 'Not critical')
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="space-y-2">
            <Label htmlFor="cost_estimate">{t('roadmap.milestone.costEstimate', 'Cost Estimate')}</Label>
            <Input
              id="cost_estimate"
              type="number"
              min="0"
              step="100"
              {...register('cost_estimate', { valueAsNumber: true })}
              placeholder="0"
            />
          </div>

          {/* Assignee Selection */}
          {projectId && collaborators.length > 0 && (
            <div className="space-y-2">
              <Label>{t('roadmap.milestone.assignedTo', 'Assigné à')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    {selectedAssigneeProfile ? (
                      <>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={selectedAssigneeProfile.profile?.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(selectedAssigneeProfile.profile?.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedAssigneeProfile.profile?.fullName || 'Utilisateur'}</span>
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {t('roadmap.milestone.selectAssignee', 'Sélectionner un responsable')}
                        </span>
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1">
                    {/* Option to clear */}
                    <button
                      type="button"
                      onClick={() => setSelectedAssignee(null)}
                      className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left ${
                        !selectedAssignee ? 'bg-accent' : ''
                      }`}
                    >
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('common.none', 'Aucun')}</span>
                    </button>
                    {collaborators.map((collaborator) => (
                      <button
                        key={collaborator.id}
                        type="button"
                        onClick={() => setSelectedAssignee(collaborator.userId)}
                        className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left ${
                          selectedAssignee === collaborator.userId ? 'bg-accent' : ''
                        }`}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={collaborator.profile?.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(collaborator.profile?.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {collaborator.profile?.fullName || 'Utilisateur'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {collaborator.role}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Team Selection */}
          <div className="space-y-2">
            <Label>{t('roadmap.milestone.assignedTeam', 'Équipe assignée')}</Label>
            <Select
              value={watch('assigned_team') || ''}
              onValueChange={(value) => setValue('assigned_team', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('roadmap.milestone.selectTeam', 'Sélectionner une équipe')} />
              </SelectTrigger>
              <SelectContent>
                {TEAM_OPTIONS.map(({ value, labelKey }) => (
                  <SelectItem key={value} value={value}>
                    {t(labelKey, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alert */}
          <div className="space-y-2">
            <Label htmlFor="alert_days_before">{t('roadmap.milestone.alertDays', 'Alerte X jours avant')}</Label>
            <Input
              id="alert_days_before"
              type="number"
              min="1"
              {...register('alert_days_before', { valueAsNumber: true })}
              placeholder={t('roadmap.milestone.alertPlaceholder', 'ex: 7 jours avant')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {milestone ? t('common.save', 'Enregistrer') : t('common.create', 'Créer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MilestoneForm;
