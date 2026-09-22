import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Phase, CreatePhaseInput } from '@/hooks/useRoadmap';

const PHASE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
];

const phaseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  budget_allocated: z.number().min(0).optional(),
  color: z.string().optional(),
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: 'End date must be after start date',
  path: ['end_date'],
});

type PhaseFormData = z.infer<typeof phaseSchema>;

interface PhaseFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreatePhaseInput, 'roadmap_id' | 'order_index'>) => void;
  phase?: Phase;
  defaultStartDate?: string;
  defaultEndDate?: string;
  isLoading?: boolean;
}

const PhaseForm: React.FC<PhaseFormProps> = ({
  open,
  onClose,
  onSubmit,
  phase,
  defaultStartDate,
  defaultEndDate,
  isLoading,
}) => {
  const { t } = useTranslation();
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<PhaseFormData>({
    resolver: zodResolver(phaseSchema),
    defaultValues: {
      name: phase?.name || '',
      description: phase?.description || '',
      start_date: phase?.start_date || defaultStartDate || format(new Date(), 'yyyy-MM-dd'),
      end_date: phase?.end_date || defaultEndDate || format(new Date(), 'yyyy-MM-dd'),
      budget_allocated: phase?.budget_allocated || undefined,
      color: phase?.color || PHASE_COLORS[0],
    },
  });

  const selectedColor = watch('color');

  const handleFormSubmit = (data: PhaseFormData) => {
    onSubmit({
      name: data.name,
      description: data.description,
      start_date: data.start_date,
      end_date: data.end_date,
      budget_allocated: data.budget_allocated,
      color: data.color,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {phase ? t('roadmap.phase.edit', 'Edit Phase') : t('roadmap.phase.create', 'Create Phase')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('roadmap.phase.name', 'Phase Name')} *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('roadmap.phase.namePlaceholder', 'e.g., Phase 1: Planning')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('roadmap.phase.description', 'Description')}</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('roadmap.phase.descriptionPlaceholder', 'Describe this phase...')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">{t('roadmap.phase.startDate', 'Start Date')} *</Label>
              <Input
                id="start_date"
                type="date"
                {...register('start_date')}
              />
              {errors.start_date && (
                <p className="text-sm text-destructive">{errors.start_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">{t('roadmap.phase.endDate', 'End Date')} *</Label>
              <Input
                id="end_date"
                type="date"
                {...register('end_date')}
              />
              {errors.end_date && (
                <p className="text-sm text-destructive">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_allocated">{t('roadmap.phase.budget', 'Budget Allocated')}</Label>
            <Input
              id="budget_allocated"
              type="number"
              min="0"
              step="1000"
              {...register('budget_allocated', { valueAsNumber: true })}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('roadmap.phase.color', 'Color')}</Label>
            <div className="flex gap-2 flex-wrap">
              {PHASE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color 
                      ? 'border-foreground scale-110' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {phase ? t('common.save', 'Save') : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PhaseForm;
