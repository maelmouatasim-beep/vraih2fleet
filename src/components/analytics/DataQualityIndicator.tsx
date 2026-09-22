import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Database, CheckCircle2, AlertCircle, AlertTriangle, Activity } from 'lucide-react';
import { RealDataMetrics } from '@/hooks/useRealDataMetrics';

interface DataQualityIndicatorProps {
  metrics: RealDataMetrics;
}

const DataQualityIndicator = ({ metrics }: DataQualityIndicatorProps) => {
  const { t } = useTranslation();

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high':
        return 'bg-green-500';
      case 'mixed':
        return 'bg-yellow-500';
      default:
        return 'bg-orange-500';
    }
  };

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'high':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t('analytics.dataQuality.high', 'Haute précision')}
          </Badge>
        );
      case 'mixed':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {t('analytics.dataQuality.mixed', 'Données mixtes')}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t('analytics.dataQuality.estimates', 'Estimations uniquement')}
          </Badge>
        );
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toFixed(0);
  };

  // Check if there's any data at all
  const hasAnyData = metrics.totalVehicles > 0 || metrics.vehiclesWithRealData > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              {t('analytics.dataQuality.title', 'Sources de données')}
            </CardTitle>
            <CardDescription>
              {t('analytics.dataQuality.description', 'Qualité et origine des données utilisées')}
            </CardDescription>
          </div>
          {hasAnyData && getQualityBadge(metrics.dataQuality)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasAnyData ? (
          <>
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('analytics.dataQuality.realData', 'Données réelles')}</span>
                <span className="font-medium">{metrics.dataQualityPercent}%</span>
              </div>
              <Progress value={metrics.dataQualityPercent} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {metrics.vehiclesWithRealData} / {metrics.totalVehicles} {t('common.vehicles', 'véhicules')}
                </span>
                {metrics.hasTelematicsData && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Activity className="w-3 h-3" />
                    {t('analytics.dataQuality.telematicsConnected', 'Télématique connectée')}
                  </span>
                )}
              </div>
            </div>

            {/* Comparison - only show if there's real data */}
            <div className="grid grid-cols-2 gap-4">
              {metrics.hasTelematicsData && metrics.totalRealKm > 0 ? (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('analytics.dataQuality.realKm', 'KM réels (télématique)')}
                  </p>
                  <p className="text-xl font-bold text-green-600">{formatNumber(metrics.totalRealKm)} km</p>
                  <p className="text-xs text-green-600 mt-1">
                    CO₂: {metrics.realCO2.toFixed(0)} t
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('analytics.dataQuality.realKm', 'KM réels (télématique)')}
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    {t('analytics.dataQuality.noRealData', 'Connecter télématique')}
                  </p>
                </div>
              )}
              
              {metrics.estimatedKm > 0 ? (
                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('analytics.dataQuality.estimatedKm', 'KM estimés (scénarios)')}
                  </p>
                  <p className="text-xl font-bold text-orange-600">{formatNumber(metrics.estimatedKm)} km</p>
                  <p className="text-xs text-orange-600 mt-1">
                    CO₂: {metrics.estimatedCO2.toFixed(0)} t
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('analytics.dataQuality.estimatedKm', 'KM estimés (scénarios)')}
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    {t('analytics.dataQuality.noEstimates', 'Créer des scénarios')}
                  </p>
                </div>
              )}
            </div>

            {/* Info message */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              {metrics.dataQuality === 'high' ? (
                <p className="text-green-700 dark:text-green-400">
                  ✓ {t('analytics.dataQuality.highMessage', 'Les projections sont basées sur vos données télématiques réelles, garantissant une haute précision.')}
                </p>
              ) : metrics.dataQuality === 'mixed' ? (
                <p className="text-yellow-700 dark:text-yellow-400">
                  ⚠ {t('analytics.dataQuality.mixedMessage', 'Certaines projections utilisent des estimations. Connectez plus de véhicules pour améliorer la précision.')}
                </p>
              ) : (
                <p className="text-orange-700 dark:text-orange-400">
                  ℹ {t('analytics.dataQuality.estimatesMessage', 'Les projections sont basées sur des estimations. Connectez vos données télématiques pour des résultats plus précis.')}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">
              {t('analytics.dataQuality.noData', 'Aucune donnée disponible')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('analytics.dataQuality.noDataHint', 'Créez des scénarios ou connectez vos données télématiques.')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataQualityIndicator;
