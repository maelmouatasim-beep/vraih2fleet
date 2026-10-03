import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { lienNotification } from "@/lib/notifications/model";
import { NotificationItem } from "./NotificationItem";
import { NotificationsBoundary } from "./NotificationsBoundary";

export const NotificationsDropdown = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, isLoading, isError, refetch, unreadCount, markAsRead, markAllAsRead, archive } = useNotifications();

  const ouvrir = (notification: Notification) => {
    if (!notification.is_read) void markAsRead(notification.id);
    const lien = lienNotification(notification);
    if (lien) {
      setOpen(false);
      navigate(lien);
    }
  };

  const libelle = unreadCount > 0 ? t("notifications.bellUnread", { count: unreadCount }) : t("notifications.bell");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={libelle} title={libelle} data-testid="notifications-bell">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-medium bg-destructive text-destructive-foreground rounded-full px-1"
              data-testid="notifications-badge"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[calc(100vw-1rem)] p-0" align="end" data-testid="notifications-panel">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">{t("notifications.title")}</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => void markAllAsRead()} data-testid="notifications-mark-all">
              <Check className="w-3 h-3" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        {/* Un élément défectueux n'emporte que la liste, pas la page. */}
        <NotificationsBoundary
          fallback={(retry) => (
            <EtatErreur
              onRetry={() => {
                refetch();
                retry();
              }}
            />
          )}
        >
          {/* Défilement vertical seul : le texte se coupe au lieu d'élargir le panneau. */}
          <div className="max-h-[360px] min-h-[120px] overflow-y-auto overflow-x-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("notifications.loading")}
              </div>
            ) : isError ? (
              <EtatErreur onRetry={refetch} />
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center" data-testid="notifications-empty">
                <Bell className="w-10 h-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => ouvrir(notification)}
                    onArchive={() => void archive(notification.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </NotificationsBoundary>

        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              navigate("/dashboard/notifications");
            }}
          >
            {t("notifications.viewAll")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

function EtatErreur({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center" role="alert" data-testid="notifications-error">
      <AlertTriangle className="w-8 h-8 text-amber-500" />
      <p className="text-sm text-muted-foreground">{t("notifications.error")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("notifications.retry")}
      </Button>
    </div>
  );
}
