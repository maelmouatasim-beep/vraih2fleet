import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/hooks/useOrganization';
import { updateOrganization } from '@/lib/supabase/organizations';
import { estNomOrganisationParDefaut } from '@/lib/organisationNom';

const SKIP_FLAG = 'h2fleet-profile-onboarding-skipped';

function readSkipFlag(): boolean {
  try {
    return localStorage.getItem(SKIP_FLAG) === 'true';
  } catch {
    return false;
  }
}

function writeSkipFlag(): void {
  try {
    localStorage.setItem(SKIP_FLAG, 'true');
  } catch {
    // stockage indisponible : on renaggera à la prochaine session, tant pis
  }
}

/**
 * Complément de profil après la première connexion : fonction, entreprise,
 * taille et types de flotte, newsletter. Tout est optionnel et passable —
 * ces champs ont quitté le formulaire d'inscription (signup minimal).
 */
export function ProfileOnboardingDialog() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    functionTitle: '',
    company: '',
    fleetSize: '',
    fleetTypes: [] as string[],
    newsletterOptIn: false,
  });

  const FUNCTION_TITLES = [
    { value: 'fleet_director', label: t('auth.signup.functionTitles.fleetDirector') },
    { value: 'transport_manager', label: t('auth.signup.functionTitles.transportManager') },
    { value: 'fleet_manager', label: t('auth.signup.functionTitles.fleetManager') },
    { value: 'operations_director', label: t('auth.signup.functionTitles.operationsDirector') },
    { value: 'other', label: t('auth.signup.functionTitles.other') },
  ];

  const FLEET_SIZES = [
    { value: 'less_than_10', label: t('auth.signup.fleetSizes.lessThan10') },
    { value: '10_50', label: t('auth.signup.fleetSizes.10to50') },
    { value: '50_200', label: t('auth.signup.fleetSizes.50to200') },
    { value: '200_500', label: t('auth.signup.fleetSizes.200to500') },
    { value: '500_plus', label: t('auth.signup.fleetSizes.500plus') },
  ];

  const FLEET_TYPES = [
    { id: 'heavy_trucks', label: t('auth.signup.fleetTypes.heavyTrucks') },
    { id: 'buses', label: t('auth.signup.fleetTypes.buses') },
    { id: 'light_commercial', label: t('auth.signup.fleetTypes.lightCommercial') },
    { id: 'passenger_vehicles', label: t('auth.signup.fleetTypes.passengerVehicles') },
    { id: 'other', label: t('auth.signup.fleetTypes.other') },
  ];

  useEffect(() => {
    if (!user?.id || readSkipFlag()) return;
    let active = true;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company, function_title, fleet_size')
        .eq('id', user.id)
        .maybeSingle();
      if (!active || !profile) return;
      if (!profile.company && !profile.function_title && !profile.fleet_size) {
        setOpen(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleSkip = () => {
    writeSkipFlag();
    setOpen(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          function_title: form.functionTitle || null,
          company: form.company.trim() || null,
          fleet_size: form.fleetSize || null,
          fleet_types: form.fleetTypes.length > 0 ? form.fleetTypes : null,
          newsletter_opt_in: form.newsletterOptIn,
        })
        .eq('id', user.id);
      if (error) throw error;
      // Audit acheteur, point 11 : le nom saisi devient celui de
      // l'organisation tant qu'elle porte le nom créé par défaut.
      const nom = form.company.trim();
      if (nom && organization && estNomOrganisationParDefaut(organization.name)) {
        try {
          await updateOrganization(organization.id, { name: nom });
          await queryClient.invalidateQueries({ queryKey: ["organization"] });
        } catch {
          // membre non administrateur : le nom se change dans Organisation
        }
      }
      writeSkipFlag();
      setOpen(false);
      toast.success(t('onboarding.profile.saved'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleSkip())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('onboarding.profile.title')}</DialogTitle>
          <DialogDescription>{t('onboarding.profile.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ob-function">{t('auth.fields.functionTitle')}</Label>
              <select
                id="ob-function"
                value={form.functionTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, functionTitle: e.target.value }))}
                disabled={isSaving}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{t('auth.placeholders.selectFunction')}</option>
                {FUNCTION_TITLES.map((title) => (
                  <option key={title.value} value={title.value}>{title.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-company">{t('auth.fields.company')}</Label>
              <Input
                id="ob-company"
                placeholder={t('auth.placeholders.company')}
                value={form.company}
                onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ob-fleet-size">{t('auth.fields.fleetSize')}</Label>
            <select
              id="ob-fleet-size"
              value={form.fleetSize}
              onChange={(e) => setForm((prev) => ({ ...prev, fleetSize: e.target.value }))}
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{t('auth.placeholders.vehicleCount')}</option>
              {FLEET_SIZES.map((size) => (
                <option key={size.value} value={size.value}>{size.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>
              {t('auth.fields.fleetType')}{' '}
              <span className="text-muted-foreground font-normal">{t('auth.fields.multipleChoices')}</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {FLEET_TYPES.map((type) => {
                const checked = form.fleetTypes.includes(type.id);
                const inputId = `ob-fleetType-${type.id}`;
                return (
                  <label
                    key={type.id}
                    htmlFor={inputId}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm',
                      checked
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50',
                      isSaving ? 'opacity-50 pointer-events-none' : '',
                    )}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      disabled={isSaving}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fleetTypes: e.target.checked
                            ? [...prev.fleetTypes.filter((id) => id !== type.id), type.id]
                            : prev.fleetTypes.filter((id) => id !== type.id),
                        }))
                      }
                      className="h-4 w-4"
                      style={{ accentColor: 'hsl(var(--primary))' }}
                    />
                    <span className="font-medium">{type.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label
            htmlFor="ob-newsletter"
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 cursor-pointer',
              isSaving ? 'opacity-50 pointer-events-none' : '',
            )}
          >
            <input
              id="ob-newsletter"
              type="checkbox"
              checked={form.newsletterOptIn}
              disabled={isSaving}
              onChange={(e) => setForm((prev) => ({ ...prev, newsletterOptIn: e.target.checked }))}
              className="mt-0.5 h-4 w-4"
              style={{ accentColor: 'hsl(var(--primary))' }}
            />
            <span className="text-sm">
              <span className="font-medium block">{t('auth.signup.newsletter')}</span>
              <span className="text-xs text-muted-foreground">{t('auth.signup.newsletterDesc')}</span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
            {t('onboarding.profile.later')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('onboarding.profile.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
