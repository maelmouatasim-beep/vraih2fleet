/**
 * Préférences des notifications dans l'application (profiles.
 * notification_preferences) : une catégorie désactivée n'est plus créée
 * pour l'utilisateur — la base l'applique à la source (trigger
 * notifications_before_insert), quel que soit l'émetteur.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { lirePreferences, type CATEGORIES, type PreferencesNotifications } from "@/lib/notifications/model";

type Categorie = (typeof CATEGORIES)[number];

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cle = ["notification-preferences", user?.id] as const;

  const lecture = useQuery({
    queryKey: cle,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return lirePreferences(data?.notification_preferences);
    },
  });

  const ecriture = useMutation({
    mutationFn: async (prefs: PreferencesNotifications) => {
      const { error } = await supabase.from("profiles").update({ notification_preferences: prefs }).eq("id", user!.id);
      if (error) throw error;
      return prefs;
    },
    onMutate: (prefs) => queryClient.setQueryData(cle, prefs),
    onSuccess: () => toast({ title: t("pages.settings.toast.saved"), description: t("pages.settings.notifications.preferencesSaved") }),
    onError: () => {
      toast({ title: t("pages.settings.toast.error"), description: t("pages.settings.toast.errorSaving"), variant: "destructive" });
      void queryClient.invalidateQueries({ queryKey: cle });
    },
  });

  const preferences = lecture.data ?? lirePreferences(null);
  return {
    preferences,
    isLoading: lecture.isLoading,
    isSaving: ecriture.isPending,
    basculer: (c: Categorie) => ecriture.mutate({ ...preferences, [c]: !preferences[c] }),
  };
}
