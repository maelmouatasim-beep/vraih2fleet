import { useTranslation } from "react-i18next";
import { useSubscription, SubscriptionTier, SubscriptionStatus } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Building2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const tierConfig: Record<SubscriptionTier, { label: string; icon: React.ElementType; className: string }> = {
  free: { label: 'Free', icon: Zap, className: 'bg-muted text-muted-foreground' },
  small: { label: 'Small Fleet', icon: Sparkles, className: 'bg-chart-ev/10 text-chart-ev border-chart-ev/20' },
  medium: { label: 'Medium Fleet', icon: Crown, className: 'bg-primary/10 text-primary border-primary/20' },
  large: { label: 'Large Fleet', icon: Building2, className: 'bg-accent/10 text-accent border-accent/20' },
};

const statusLabels: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  canceled: 'Canceled',
  expired: 'Expired',
};

interface SubscriptionBadgeProps {
  showStatus?: boolean;
  className?: string;
}

export const SubscriptionBadge = ({ showStatus = true, className }: SubscriptionBadgeProps) => {
  const { t } = useTranslation();
  const { tier, status, daysLeftInTrial, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("animate-pulse", className)}>
        {t('common.loading', 'Loading...')}
      </Badge>
    );
  }

  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant="outline" className={cn("gap-1.5", config.className)}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </Badge>
      {showStatus && status === 'trial' && daysLeftInTrial !== null && (
        <Badge variant="secondary" className="text-xs">
          {daysLeftInTrial} days left
        </Badge>
      )}
      {showStatus && status !== 'active' && status !== 'trial' && (
        <Badge variant="destructive" className="text-xs">
          {statusLabels[status]}
        </Badge>
      )}
    </div>
  );
};
