import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell, 
  MessageSquare, 
  Users, 
  GitBranch, 
  AtSign, 
  CheckCircle2, 
  Clock,
  CheckCheck,
  Filter,
  Inbox,
  UserPlus,
  ListTodo
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { cn, getDateLocale } from '@/lib/utils';

type NotificationType = 'all' | 'comments' | 'assignments' | 'invitations' | 'versions' | 'mentions';

interface NotificationTypeConfig {
  type: NotificationType;
  labelKey: string;
  icon: React.ReactNode;
  types: string[];
}

const NOTIFICATION_TYPE_CONFIGS: NotificationTypeConfig[] = [
  { type: 'all', labelKey: 'notifications.filters.all', icon: <Inbox className="w-4 h-4" />, types: [] },
  { type: 'comments', labelKey: 'notifications.filters.comments', icon: <MessageSquare className="w-4 h-4" />, types: ['comment', 'reply'] },
  { type: 'assignments', labelKey: 'notifications.filters.assignments', icon: <ListTodo className="w-4 h-4" />, types: ['task_assigned', 'milestone_assigned'] },
  { type: 'invitations', labelKey: 'notifications.filters.invitations', icon: <UserPlus className="w-4 h-4" />, types: ['invitation', 'collaboration_accepted'] },
  { type: 'mentions', labelKey: 'notifications.filters.mentions', icon: <AtSign className="w-4 h-4" />, types: ['task_mentioned'] },
  { type: 'versions', labelKey: 'notifications.filters.versions', icon: <GitBranch className="w-4 h-4" />, types: ['version'] },
];

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'comment':
    case 'reply':
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
    case 'invitation':
    case 'collaboration_accepted':
      return <UserPlus className="w-4 h-4 text-purple-500" />;
    case 'task_assigned':
    case 'milestone_assigned':
      return <ListTodo className="w-4 h-4 text-green-500" />;
    case 'task_mentioned':
      return <AtSign className="w-4 h-4 text-orange-500" />;
    case 'version':
      return <GitBranch className="w-4 h-4 text-cyan-500" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
};

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = getDateLocale(i18n.language);
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<NotificationType>('all');

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    
    const config = NOTIFICATION_TYPE_CONFIGS.find(c => c.type === activeFilter);
    if (!config) return notifications;
    
    return notifications.filter(n => config.types.includes(n.type));
  }, [notifications, activeFilter]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { label: string; notifications: Notification[] }[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const thisWeek: Notification[] = [];
    const older: Notification[] = [];

    filteredNotifications.forEach(n => {
      const date = new Date(n.created_at);
      if (isToday(date)) {
        today.push(n);
      } else if (isYesterday(date)) {
        yesterday.push(n);
      } else if (isThisWeek(date)) {
        thisWeek.push(n);
      } else {
        older.push(n);
      }
    });

    if (today.length > 0) {
      groups.push({ label: t('notifications.today', "Aujourd'hui"), notifications: today });
    }
    if (yesterday.length > 0) {
      groups.push({ label: t('notifications.yesterday', 'Hier'), notifications: yesterday });
    }
    if (thisWeek.length > 0) {
      groups.push({ label: t('notifications.thisWeek', 'Cette semaine'), notifications: thisWeek });
    }
    if (older.length > 0) {
      groups.push({ label: t('notifications.older', 'Plus ancien'), notifications: older });
    }

    return groups;
  }, [filteredNotifications, t]);

  // Count notifications per type
  const typeCounts = useMemo(() => {
    const counts: Record<NotificationType, number> = {
      all: notifications.length,
      comments: 0,
      assignments: 0,
      invitations: 0,
      mentions: 0,
      versions: 0,
    };

    notifications.forEach(n => {
      NOTIFICATION_TYPE_CONFIGS.forEach(config => {
        if (config.type !== 'all' && config.types.includes(n.type)) {
          counts[config.type]++;
        }
      });
    });

    return counts;
  }, [notifications]);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate to related content
    if (notification.project_id) {
      if (notification.type === 'task_assigned' || notification.type === 'task_mentioned') {
        navigate(`/dashboard/projects/${notification.project_id}/tasks`);
      } else if (notification.type === 'milestone_assigned') {
        navigate(`/dashboard/roadmap?project=${notification.project_id}`);
      } else {
        navigate(`/dashboard/projects/${notification.project_id}`);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {t('notifications.title', 'Notifications')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 
                  ? t('notifications.unreadCount', '{{count}} non lue(s)', { count: unreadCount })
                  : t('notifications.allRead', 'Tout est à jour')}
              </p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              {t('notifications.markAllRead', 'Tout marquer comme lu')}
            </Button>
          )}
        </div>

        {/* Filters */}
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as NotificationType)} className="mb-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            {NOTIFICATION_TYPE_CONFIGS.map(config => (
              <TabsTrigger 
                key={config.type} 
                value={config.type}
                className="flex items-center gap-1.5 px-3 py-1.5"
              >
                {config.icon}
                <span className="hidden sm:inline">
                  {t(config.labelKey, config.type)}
                </span>
                {typeCounts[config.type] > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {typeCounts[config.type]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Notifications List */}
        <Card>
          <CardContent className="p-0">
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
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Inbox className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">
                  {t('notifications.empty', 'Aucune notification')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeFilter === 'all' 
                    ? t('notifications.emptyDesc', 'Vous n\'avez pas encore de notifications')
                    : t('notifications.emptyFilterDesc', 'Aucune notification de ce type')}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-300px)]">
                {groupedNotifications.map((group, groupIndex) => (
                  <div key={group.label}>
                    <div className="px-4 py-2 bg-muted/50 border-b sticky top-0">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {group.label}
                      </span>
                    </div>
                    {group.notifications.map((notification, index) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          'w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50 border-b last:border-b-0',
                          !notification.is_read && 'bg-primary/5'
                        )}
                      >
                        {/* Avatar */}
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={notification.actor_profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {notification.actor_profile?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 p-1 bg-background rounded-full border">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              'text-sm leading-tight',
                              !notification.is_read && 'font-medium'
                            )}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { 
                                addSuffix: true, 
                                locale: dateLocale 
                              })}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
