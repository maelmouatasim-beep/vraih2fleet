/**
 * Notifications de l'utilisateur — UNE source partagée par la cloche, la
 * page Notifications et l'Accueil (NotificationsProvider, monté une fois
 * dans App.tsx) :
 *  - liste (50 dernières non archivées) et compteur EXACT de non-lues
 *    (requête de comptage, pas la longueur de la liste) dans le cache
 *    TanStack Query → mêmes chiffres partout ;
 *  - UN seul canal temps réel par session, au nom unique, retiré au
 *    démontage ou au changement d'utilisateur ;
 *  - actions : lire, tout lire, archiver (aucune suppression en base).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { texteNotification, type NotificationRow } from "@/lib/notifications/model";

export interface Notification extends NotificationRow {
  actor_profile?: { full_name: string | null; avatar_url: string | null };
}

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const LIMITE_NOTIFICATIONS = 50;
const cles = {
  toutes: (uid: string | undefined) => ["notifications", uid] as const,
  liste: (uid: string | undefined) => ["notifications", uid, "liste"] as const,
  nonLues: (uid: string | undefined) => ["notifications", uid, "non-lues"] as const,
};

async function lireNotifications(uid: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(LIMITE_NOTIFICATIONS);
  if (error) throw error;
  const lignes = (data ?? []) as unknown as NotificationRow[];
  const acteurs = [...new Set(lignes.map((n) => n.actor_id).filter((x): x is string => !!x))];
  const profils = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  if (acteurs.length > 0) {
    // Profils d'autrui illisibles (RLS) : on garde le nom figé dans payload.
    const { data: p } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", acteurs);
    for (const x of p ?? []) profils.set(x.id, { full_name: x.full_name, avatar_url: x.avatar_url });
  }
  return lignes.map((n) => ({ ...n, actor_profile: n.actor_id ? profils.get(n.actor_id) : undefined }));
}

async function compterNonLuesEnBase(uid: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("is_read", false)
    .is("archived_at", null);
  if (error) throw error;
  return count ?? 0;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id;
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const liste = useQuery({
    queryKey: cles.liste(uid),
    queryFn: () => lireNotifications(uid as string),
    enabled: !!uid,
    staleTime: 30_000,
  });
  const nonLues = useQuery({
    queryKey: cles.nonLues(uid),
    queryFn: () => compterNonLuesEnBase(uid as string),
    enabled: !!uid,
    staleTime: 30_000,
  });

  const rafraichir = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: cles.toutes(uid) });
  }, [queryClient, uid]);

  // Un canal par session, nom unique : pas de collision entre onglets,
  // ni entre deux montages successifs (StrictMode, changement d'utilisateur).
  useEffect(() => {
    if (!uid) return;
    const nom = `notifications:${uid}:${Math.random().toString(36).slice(2, 10)}`;
    const canal = supabase
      .channel(nom)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (evenement) => {
          rafraichir();
          if (evenement.eventType === "INSERT") {
            const n = evenement.new as NotificationRow;
            try {
              const { titre, message } = texteNotification(n, (k, v) => t(k, v), i18n.language, uid);
              toast(titre, { description: message });
            } catch {
              // Un toast raté ne doit jamais casser la page.
            }
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
    // t et i18n.language : un changement de langue ne recrée pas le canal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, rafraichir]);

  const majLocale = useCallback(
    (fn: (l: Notification[]) => Notification[]) => {
      queryClient.setQueryData<Notification[]>(cles.liste(uid), (l) => (l ? fn(l) : l));
    },
    [queryClient, uid],
  );

  const lire = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", uid as string);
      if (error) throw error;
    },
    onMutate: (id) => majLocale((l) => l.map((n) => (n.id === id ? { ...n, is_read: true } : n))),
    onSettled: rafraichir,
  });

  const toutLire = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", uid as string)
        .eq("is_read", false)
        .is("archived_at", null);
      if (error) throw error;
    },
    onMutate: () => {
      majLocale((l) => l.map((n) => ({ ...n, is_read: true })));
      queryClient.setQueryData(cles.nonLues(uid), 0);
    },
    onSettled: rafraichir,
  });

  const archiver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ archived_at: new Date().toISOString(), is_read: true })
        .eq("id", id)
        .eq("user_id", uid as string);
      if (error) throw error;
    },
    onMutate: (id) => majLocale((l) => l.filter((n) => n.id !== id)),
    onSettled: rafraichir,
  });

  const valeur = useMemo<NotificationsContextValue>(
    () => ({
      notifications: uid ? liste.data ?? [] : [],
      unreadCount: uid ? nonLues.data ?? 0 : 0,
      isLoading: !!uid && (liste.isLoading || nonLues.isLoading),
      isError: !!uid && (liste.isError || nonLues.isError),
      refetch: rafraichir,
      markAsRead: async (id) => {
        await lire.mutateAsync(id).catch(() => toast.error(t("notifications.error")));
      },
      markAllAsRead: async () => {
        await toutLire.mutateAsync().catch(() => toast.error(t("notifications.error")));
      },
      archive: async (id) => {
        await archiver.mutateAsync(id).catch(() => toast.error(t("notifications.error")));
      },
    }),
    // Les mutations sont stables ; on suit les données et l'utilisateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, liste.data, liste.isLoading, liste.isError, nonLues.data, nonLues.isLoading, nonLues.isError, rafraichir, t],
  );

  return <NotificationsContext.Provider value={valeur}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications doit être utilisé sous NotificationsProvider");
  return ctx;
}
