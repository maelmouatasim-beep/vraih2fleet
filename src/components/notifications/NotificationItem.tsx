import { Archive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getDateLocale } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Notification } from "@/hooks/useNotifications";
import { texteNotification } from "@/lib/notifications/model";
import { apparenceNotification } from "./appearance";

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onArchive?: () => void;
  /** « page » : texte sur plusieurs lignes (page Notifications). */
  variant?: "bell" | "page";
}

/** Date relative dans la langue de l'interface ; date invalide → vide. */
export function dateRelative(iso: string, langue: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true, locale: getDateLocale(langue) });
}

function initiales(nom: string | null | undefined): string {
  if (!nom) return "";
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => m[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const NotificationItem = ({ notification, onClick, onArchive, variant = "bell" }: NotificationItemProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { icone: Icone, classes } = apparenceNotification(notification);
  const { titre, message } = texteNotification(notification, (k, v) => t(k, v), i18n.language, user?.id);
  const nomActeur = notification.actor_profile?.full_name ?? (notification.payload?.actor as string | undefined);
  const lettres = initiales(nomActeur);
  const page = variant === "page";

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-lg transition-colors hover:bg-muted/50",
        page ? "p-4" : "p-3",
        !notification.is_read && "bg-primary/5",
      )}
      data-testid="notification-item"
      data-type={notification.type}
      data-read={notification.is_read ? "true" : "false"}
    >
      <button type="button" onClick={onClick} className="flex flex-1 min-w-0 items-start gap-3 text-left">
        <div className="relative shrink-0">
          {lettres ? (
            <Avatar className="w-9 h-9">
              <AvatarImage src={notification.actor_profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-muted">{lettres}</AvatarFallback>
            </Avatar>
          ) : (
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center", classes)}>
              <Icone className="w-4 h-4" />
            </div>
          )}
          {lettres && (
            <div className={cn("absolute -bottom-1 -right-1 p-1 rounded-full", classes)}>
              <Icone className="w-3 h-3" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm",
              page ? "leading-tight" : "truncate",
              !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {titre}
          </p>
          {message && (
            <p className={cn("text-xs text-muted-foreground mt-0.5", page ? "line-clamp-3" : "line-clamp-2")}>{message}</p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">{dateRelative(notification.created_at, i18n.language)}</p>
        </div>
      </button>
      <div className="flex flex-col items-center gap-2 shrink-0">
        {!notification.is_read && <span className="w-2 h-2 bg-primary rounded-full mt-2" aria-hidden />}
        {onArchive && (
          <button
            type="button"
            onClick={onArchive}
            className="p-1 rounded text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted focus:opacity-100"
            aria-label={t("notifications.archive")}
            title={t("notifications.archive")}
            data-testid="notification-archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
