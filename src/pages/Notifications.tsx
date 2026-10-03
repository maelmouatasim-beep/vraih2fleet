import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { isToday, isYesterday, isThisWeek } from "date-fns";
import { AlertTriangle, CheckCheck, Inbox } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Page, PageHeader } from "@/components/layout/Page";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem, NotificationsBoundary } from "@/components/notifications";
import { CATEGORIES, categorieNotification, lienNotification } from "@/lib/notifications/model";

const FILTRES = ["all", "unread", ...CATEGORIES] as const;
type Filtre = (typeof FILTRES)[number];

function garder(n: Notification, filtre: Filtre): boolean {
  if (filtre === "all") return true;
  if (filtre === "unread") return !n.is_read;
  return categorieNotification(n.type) === filtre;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, isLoading, isError, refetch, unreadCount, markAsRead, markAllAsRead, archive } = useNotifications();
  const [filtre, setFiltre] = useState<Filtre>("all");

  const filtrees = useMemo(() => notifications.filter((n) => garder(n, filtre)), [notifications, filtre]);

  const nombres = useMemo(
    () => Object.fromEntries(FILTRES.map((f) => [f, notifications.filter((n) => garder(n, f)).length])) as Record<Filtre, number>,
    [notifications],
  );

  const groupes = useMemo(() => {
    const seaux: Record<"today" | "yesterday" | "thisWeek" | "older", Notification[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };
    for (const n of filtrees) {
      const d = new Date(n.created_at);
      const cle = isToday(d) ? "today" : isYesterday(d) ? "yesterday" : isThisWeek(d) ? "thisWeek" : "older";
      seaux[cle].push(n);
    }
    return (Object.keys(seaux) as (keyof typeof seaux)[])
      .filter((k) => seaux[k].length > 0)
      .map((k) => ({ cle: k, libelle: t(`notifications.${k}`), notifications: seaux[k] }));
  }, [filtrees, t]);

  const ouvrir = (n: Notification) => {
    if (!n.is_read) void markAsRead(n.id);
    const lien = lienNotification(n);
    if (lien) navigate(lien);
  };

  return (
    <DashboardLayout>
      <Page largeur="etroite">
        <PageHeader
          titre={t("notifications.title")}
          sousTitre={
            <span data-testid="notifications-page-unread">
              {isLoading ? t("notifications.loading") : unreadCount > 0 ? t("notifications.unreadCount", { count: unreadCount }) : t("notifications.allRead")}
            </span>
          }
          actions={
            !isLoading && unreadCount > 0 ? (
              <Button variant="outline" onClick={() => void markAllAsRead()}>
                <CheckCheck className="w-4 h-4 mr-2" />
                {t("notifications.markAllRead")}
              </Button>
            ) : undefined
          }
        />

        <Tabs value={filtre} onValueChange={(v) => setFiltre(v as Filtre)}>
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            {FILTRES.map((f) => (
              <TabsTrigger key={f} value={f} className="flex items-center gap-1.5 px-3 py-1.5">
                {t(`notifications.filters.${f}`)}
                {nombres[f] > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {nombres[f]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            <NotificationsBoundary fallback={(retry) => <Erreur onRetry={() => { refetch(); retry(); }} />}>
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isError ? (
                <Erreur onRetry={refetch} />
              ) : filtrees.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Inbox className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">{t("notifications.empty")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {filtre === "all" ? t("notifications.emptyDesc") : t("notifications.emptyFilterDesc")}
                  </p>
                </div>
              ) : (
                groupes.map((g) => (
                  <div key={g.cle}>
                    <div className="px-4 py-2 bg-muted/50 border-b">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{g.libelle}</span>
                    </div>
                    <div className="divide-y">
                      {g.notifications.map((n) => (
                        <NotificationItem
                          key={n.id}
                          variant="page"
                          notification={n}
                          onClick={() => ouvrir(n)}
                          onArchive={() => void archive(n.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </NotificationsBoundary>
          </CardContent>
        </Card>
      </Page>
    </DashboardLayout>
  );
}

function Erreur({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="p-12 flex flex-col items-center gap-3 text-center" role="alert">
      <AlertTriangle className="w-8 h-8 text-amber-500" />
      <p className="text-sm text-muted-foreground">{t("notifications.error")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("notifications.retry")}
      </Button>
    </div>
  );
}
