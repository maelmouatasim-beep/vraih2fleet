import { MessageCircle, Reply, UserPlus, History, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

const typeIcons = {
  comment: MessageCircle,
  reply: Reply,
  invitation: UserPlus,
  version: History,
  role_change: Shield
};

const typeColors = {
  comment: 'text-blue-500 bg-blue-500/10',
  reply: 'text-purple-500 bg-purple-500/10',
  invitation: 'text-green-500 bg-green-500/10',
  version: 'text-orange-500 bg-orange-500/10',
  role_change: 'text-yellow-500 bg-yellow-500/10'
};

export const NotificationItem = ({ notification, onClick }: NotificationItemProps) => {
  const { i18n } = useTranslation();
  const Icon = typeIcons[notification.type];
  const colorClass = typeColors[notification.type];

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: i18n.language === 'fr' ? fr : enUS
  });

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 rounded-lg",
        !notification.is_read && "bg-primary/5"
      )}
    >
      <div className="relative">
        <Avatar className="w-9 h-9">
          <AvatarImage src={notification.actor_profile?.avatar_url || ''} />
          <AvatarFallback className="text-xs bg-muted">
            {getInitials(notification.actor_profile?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className={cn(
          "absolute -bottom-1 -right-1 p-1 rounded-full",
          colorClass
        )}>
          <Icon className="w-3 h-3" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm truncate",
          !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground"
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {timeAgo}
        </p>
      </div>

      {!notification.is_read && (
        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
      )}
    </button>
  );
};
