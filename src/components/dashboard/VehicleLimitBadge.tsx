import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscription } from '@/hooks/useSubscription';
import { Truck, Sparkles, Crown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VehicleLimitBadgeProps {
  className?: string;
  variant?: 'badge' | 'card';
}

export function VehicleLimitBadge({ className, variant = 'badge' }: VehicleLimitBadgeProps) {
  const { t } = useTranslation();
  const { tier, vehicleLimit, isUnlimited, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("animate-pulse", className)}>
        {t('common.loading', 'Loading...')}
      </Badge>
    );
  }

  const tierConfig = {
    free: { icon: Truck, className: 'bg-muted text-muted-foreground' },
    small: { icon: Sparkles, className: 'bg-chart-ev/10 text-chart-ev border-chart-ev/20' },
    medium: { icon: Crown, className: 'bg-primary/10 text-primary border-primary/20' },
    large: { icon: Building2, className: 'bg-accent/10 text-accent border-accent/20' },
  };

  const config = tierConfig[tier];
  const Icon = config.icon;
  const limitText = isUnlimited 
    ? t('subscription.limits.unlimited')
    : t('subscription.limits.upTo', { count: vehicleLimit });

  if (variant === 'card') {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex items-center gap-3 py-3 px-4">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {t('subscription.limits.yourPlan')}: {t(`subscription.tier.${tier}`)}
            </p>
            <p className="text-xs text-muted-foreground">{limitText}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Badge variant="outline" className={cn("gap-1.5", config.className, className)}>
      <Icon className="w-3.5 h-3.5" />
      {t(`subscription.badge.${tier === 'free' ? 'small' : tier}`)}
    </Badge>
  );
}
