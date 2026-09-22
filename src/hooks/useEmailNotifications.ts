import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { useTranslation } from 'react-i18next';

export interface EmailNotificationPreferences {
  subsidy_reminders: boolean;
  collaboration_invites: boolean;
  project_comments: boolean;
  weekly_digest: boolean;
}

const DEFAULT_PREFERENCES: EmailNotificationPreferences = {
  subsidy_reminders: true,
  collaboration_invites: true,
  project_comments: false,
  weekly_digest: false,
};

export function useEmailNotifications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<EmailNotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_notifications')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.email_notifications && typeof data.email_notifications === 'object') {
        const prefs = data.email_notifications as Record<string, unknown>;
        setPreferences({
          subsidy_reminders: typeof prefs.subsidy_reminders === 'boolean' ? prefs.subsidy_reminders : DEFAULT_PREFERENCES.subsidy_reminders,
          collaboration_invites: typeof prefs.collaboration_invites === 'boolean' ? prefs.collaboration_invites : DEFAULT_PREFERENCES.collaboration_invites,
          project_comments: typeof prefs.project_comments === 'boolean' ? prefs.project_comments : DEFAULT_PREFERENCES.project_comments,
          weekly_digest: typeof prefs.weekly_digest === 'boolean' ? prefs.weekly_digest : DEFAULT_PREFERENCES.weekly_digest,
        });
      }
    } catch (error) {
      console.error('Error fetching email preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = async (newPreferences: Partial<EmailNotificationPreferences>) => {
    if (!user?.id) return;

    setIsSaving(true);
    const updatedPreferences = { ...preferences, ...newPreferences };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email_notifications: updatedPreferences })
        .eq('id', user.id);

      if (error) throw error;

      setPreferences(updatedPreferences);
      toast({
        title: t('pages.settings.toast.saved'),
        description: t('pages.settings.notifications.preferencesSaved'),
      });
    } catch (error) {
      console.error('Error updating email preferences:', error);
      toast({
        title: t('pages.settings.toast.error'),
        description: t('pages.settings.toast.errorSaving'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = async (key: keyof EmailNotificationPreferences) => {
    await updatePreferences({ [key]: !preferences[key] });
  };

  return {
    preferences,
    isLoading,
    isSaving,
    updatePreferences,
    togglePreference,
    refetch: fetchPreferences,
  };
}
