import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

export const NotificationsDropdown = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    if (notification.project_id) {
      setOpen(false);
      // Navigate based on notification type
      if (notification.type === 'task_assigned' || notification.type === 'task_mentioned') {
        navigate(`/dashboard/projects/${notification.project_id}/tasks`);
      } else if (notification.type === 'milestone_assigned') {
        navigate(`/dashboard/roadmap?project=${notification.project_id}`);
      } else {
        navigate(`/dashboard/projects/${notification.project_id}`);
      }
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate('/dashboard/notifications');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-medium bg-destructive text-destructive-foreground rounded-full px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">
            {t('notifications.title')}
          </h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => markAllAsRead()}
            >
              <Check className="w-3 h-3" />
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[360px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="w-10 h-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('notifications.empty')}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* View All Link */}
        <div className="p-2 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs"
            onClick={handleViewAll}
          >
            {t('notifications.viewAll', 'Voir toutes les notifications')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
