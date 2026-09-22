import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useSubscription, SubscriptionTier } from '@/hooks/useSubscription';

interface VehicleLimitAlertProps {
  vehicleCount: number;
}

export function VehicleLimitAlert({ vehicleCount }: VehicleLimitAlertProps) {
  const { t } = useTranslation();
  const { tier, vehicleLimit, isVehicleCountAllowed } = useSubscription();

  // Don't show alert if within limits
  if (isVehicleCountAllowed(vehicleCount)) {
    return null;
  }

  const tierLabel = t(`subscription.tier.${tier}`);

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t('subscription.limits.exceededTitle')}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {t('subscription.limits.exceededMessage', { 
            tier: tierLabel, 
            limit: vehicleLimit, 
            count: vehicleCount 
          })}
        </p>
        <p className="text-sm">
          {t('subscription.limits.upgradeMessage')}
        </p>
        <Button variant="outline" size="sm" asChild className="mt-2">
          <Link to="/contact" className="gap-2">
            {t('subscription.limits.upgradeCta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
