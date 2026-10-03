import { useTranslation } from "react-i18next";
import { useSubscription, SubscriptionTier } from "@/hooks/useSubscription";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type Ton } from "@/components/layout/States";
import { Crown, Sparkles, Building2, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONES: Record<SubscriptionTier, LucideIcon> = { free: Zap, small: Sparkles, medium: Crown, large: Building2 };
const TON_STATUT: Record<"canceled" | "expired", Ton> = { canceled: "danger", expired: "danger" };

interface SubscriptionBadgeProps {
  showStatus?: boolean;
  className?: string;
}

export const SubscriptionBadge = ({ showStatus = true, className }: SubscriptionBadgeProps) => {
  const { t } = useTranslation();
  const { tier, status, daysLeftInTrial, isLoading } = useSubscription();

  if (isLoading) return <Skeleton className={cn("h-6 w-28 rounded-full", className)} />;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <StatusBadge ton="info" icone={ICONES[tier]}>
        {t(`dashboard.subscriptionBadge.tiers.${tier}`)}
      </StatusBadge>
      {showStatus && status === "trial" && daysLeftInTrial !== null && (
        <StatusBadge ton="attention">{t("dashboard.subscriptionBadge.daysLeft", { count: daysLeftInTrial })}</StatusBadge>
      )}
      {showStatus && (status === "canceled" || status === "expired") && (
        <StatusBadge ton={TON_STATUT[status]}>{t(`dashboard.subscriptionBadge.statuses.${status}`)}</StatusBadge>
      )}
    </div>
  );
};
