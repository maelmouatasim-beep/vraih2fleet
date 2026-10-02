import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

const demoRequestSchema = z.object({
  fullName: z.string().min(2, 'forms.validation.nameRequired').max(100),
  email: z.string().email('forms.validation.emailInvalid').max(255),
  company: z.string().min(2, 'forms.validation.companyRequired').max(100),
  fleetSize: z.string().min(1, 'forms.validation.fleetSizeRequired'),
  message: z.string().max(500).optional(),
});

type DemoRequestFormValues = z.infer<typeof demoRequestSchema>;

interface DemoRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoRequestModal({ open, onOpenChange }: DemoRequestModalProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // Pot de miel anti-robots : champ invisible, toujours vide pour un humain.
  const [honeypot, setHoneypot] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DemoRequestFormValues>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      fullName: '',
      email: '',
      company: '',
      fleetSize: '',
      message: '',
    },
  });

  const onSubmit = async (data: DemoRequestFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Le gabarit et le destinataire sont fixés côté serveur ; le serveur
      // enregistre aussi le lead dans email_leads.
      const { data: envoi, error } = await supabase.functions.invoke('send-email', {
        body: {
          templateType: 'demo_request',
          data: {
            fullName: data.fullName,
            email: data.email,
            company: data.company,
            fleetSize: data.fleetSize,
            message: data.message || undefined,
            website: honeypot || undefined,
          },
        },
      });

      if (error) throw error;

      setIsSuccess(true);
      
      toast({
        title: envoi?.emailSent === false
          ? t('servicesExternes.demandeEnregistree')
          : t('demoModal.success.title'),
        description: envoi?.emailSent === false
          ? t('servicesExternes.emailEnregistreSansEnvoi')
          : t('demoModal.success.message'),
      });

      // Reset after delay
      setTimeout(() => {
        setIsSuccess(false);
        reset();
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error('Error sending demo request:', error);
      toast({
        title: t('demoModal.error.title', 'Error'),
        description: t('demoModal.error.message', 'Failed to submit your request. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsSuccess(false);
      reset();
      onOpenChange(false);
    }
  };

  const fleetSizeOptions = [
    { value: '1-10', label: t('demoModal.fleetSizes.small') },
    { value: '11-50', label: t('demoModal.fleetSizes.medium') },
    { value: '51-200', label: t('demoModal.fleetSizes.large') },
    { value: '200+', label: t('demoModal.fleetSizes.enterprise') },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('demoModal.title')}</DialogTitle>
          <DialogDescription>{t('demoModal.subtitle')}</DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('demoModal.success.title')}</h3>
            <p className="text-muted-foreground">{t('demoModal.success.message')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('demoModal.fields.fullName')}</Label>
                <Input
                  id="fullName"
                  placeholder={t('demoModal.placeholders.fullName')}
                  {...register('fullName')}
                  disabled={isSubmitting}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{t(errors.fullName.message || '')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('demoModal.fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('demoModal.placeholders.email')}
                  {...register('email')}
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{t(errors.email.message || '')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">{t('demoModal.fields.company')}</Label>
                <Input
                  id="company"
                  placeholder={t('demoModal.placeholders.company')}
                  {...register('company')}
                  disabled={isSubmitting}
                />
                {errors.company && (
                  <p className="text-sm text-destructive">{t(errors.company.message || '')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('demoModal.fields.fleetSize')}</Label>
                <Select
                  onValueChange={(value) => setValue('fleetSize', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('demoModal.placeholders.fleetSize')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fleetSizeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fleetSize && (
                  <p className="text-sm text-destructive">{t(errors.fleetSize.message || '')}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t('demoModal.fields.message')}</Label>
              <Textarea
                id="message"
                placeholder={t('demoModal.placeholders.message')}
                rows={3}
                {...register('message')}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t('forms.common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('demoModal.submitting')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {t('demoModal.submit')}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DemoRequestModal;
