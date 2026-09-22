import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { format, addYears } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Roadmap, CreateRoadmapInput } from '@/hooks/useRoadmap';

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'];

const roadmapSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  total_budget: z.number().min(0).optional(),
  currency: z.string().default('CAD'),
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: 'End date must be after start date',
  path: ['end_date'],
});

type RoadmapFormData = z.infer<typeof roadmapSchema>;

interface RoadmapFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreateRoadmapInput, 'project_id'>) => void;
  roadmap?: Roadmap;
  isLoading?: boolean;
}

const RoadmapForm: React.FC<RoadmapFormProps> = ({
  open,
  onClose,
  onSubmit,
  roadmap,
  isLoading,
}) => {
  const { t } = useTranslation();
  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultEnd = format(addYears(new Date(), 3), 'yyyy-MM-dd');
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<RoadmapFormData>({
    resolver: zodResolver(roadmapSchema),
    defaultValues: {
      name: roadmap?.name || '',
      description: roadmap?.description || '',
      start_date: roadmap?.start_date || today,
      end_date: roadmap?.end_date || defaultEnd,
      total_budget: roadmap?.total_budget || undefined,
      currency: roadmap?.currency || 'CAD',
    },
  });

  const handleFormSubmit = (data: RoadmapFormData) => {
    onSubmit({
      name: data.name,
      description: data.description,
      start_date: data.start_date,
      end_date: data.end_date,
      total_budget: data.total_budget,
      currency: data.currency,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {roadmap 
              ? t('roadmap.form.editTitle', 'Edit Roadmap') 
              : t('roadmap.form.createTitle', 'Create Transition Roadmap')
            }
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('roadmap.form.name', 'Roadmap Name')} *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('roadmap.form.namePlaceholder', 'e.g., Fleet Electrification 2026-2029')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('roadmap.form.description', 'Description')}</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('roadmap.form.descriptionPlaceholder', 'Describe your transition plan...')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">{t('roadmap.form.startDate', 'Start Date')} *</Label>
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
              <Label htmlFor="end_date">{t('roadmap.form.endDate', 'End Date')} *</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_budget">{t('roadmap.form.totalBudget', 'Total Budget')}</Label>
              <Input
                id="total_budget"
                type="number"
                min="0"
                step="10000"
                {...register('total_budget', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('roadmap.form.currency', 'Currency')}</Label>
              <Select
                value={watch('currency')}
                onValueChange={(value) => setValue('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {roadmap ? t('common.save', 'Save') : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RoadmapForm;
