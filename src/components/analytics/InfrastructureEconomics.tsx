import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  Zap, 
  Fuel, 
  TrendingUp, 
  Clock, 
  Gauge,
  DollarSign,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getTotalInfrastructureInvestment } from '@/lib/supabase/infrastructure';

interface InfrastructureEconomicsData {
  totalH2Stations: number;
  totalEvChargers: number;
  h2CapexPerStation: number;
  evCapexPerCharger: number;
  paybackYears: number;
  utilizationH2: number;
  utilizationEv: number;
  totalCapex: number;
  totalOpex10y: number;
  evCapex: number;
  h2Capex: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const InfrastructureEconomics = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<InfrastructureEconomicsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const investment = await getTotalInfrastructureInvestment(user.id);
        
        const h2CapexPerStation = investment.totalH2Stations > 0 
          ? investment.h2Capex / investment.totalH2Stations 
          : 2500000;
        
        const evCapexPerCharger = investment.totalEvChargers > 0 
          ? investment.evCapex / investment.totalEvChargers 
          : 60000;

        // Estimate payback based on annual savings (simplified)
        const annualOpex = (investment.evAnnualOpex + investment.h2AnnualOpex);
        const estimatedAnnualSavings = annualOpex * 0.3; // 30% savings vs diesel
        const paybackYears = estimatedAnnualSavings > 0 
          ? investment.totalCapex / estimatedAnnualSavings 
          : 7;

        // Estimate utilization (mock values for now)
        const utilizationH2 = investment.totalH2Stations > 0 ? 65 : 0;
        const utilizationEv = investment.totalEvChargers > 0 ? 72 : 0;

        setData({
          ...investment,
          h2CapexPerStation,
          evCapexPerCharger,
          paybackYears: Math.min(15, paybackYears),
          utilizationH2,
          utilizationEv,
        });
      } catch (err) {
        console.error('Error fetching infrastructure economics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">{t('common.loading', 'Loading...')}</div>
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.totalH2Stations === 0 && data.totalEvChargers === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t('analytics.infrastructure.title', 'Économie Infrastructure')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-muted-foreground">
            {t('analytics.infrastructure.noPlans', 'Aucun plan d\'infrastructure créé')}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('analytics.infrastructure.createPlan', 'Créez un plan infrastructure pour voir les économies')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          {t('analytics.infrastructure.title', 'Économie Infrastructure')}
        </CardTitle>
        <CardDescription>
          {t('analytics.infrastructure.description', 'Métriques financières de l\'infrastructure')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Fuel className="h-4 w-4" />
              <span className="text-xs font-medium">{t('analytics.infrastructure.costPerH2', 'Coût/Station H₂')}</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.h2CapexPerStation)}</p>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">{t('analytics.infrastructure.costPerEv', 'Coût/Borne EV')}</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.evCapexPerCharger)}</p>
          </div>
          
          <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">{t('analytics.infrastructure.payback', 'Retour sur invest.')}</span>
            </div>
            <p className="text-xl font-bold">{data.paybackYears.toFixed(1)} {t('common.years', 'ans')}</p>
          </div>
          
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">{t('analytics.infrastructure.totalCapex', 'CAPEX Total')}</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.totalCapex)}</p>
          </div>
        </div>

        {/* Utilization */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            {t('analytics.infrastructure.utilization', 'Taux d\'utilisation')}
          </h4>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Fuel className="h-3 w-3 text-blue-600" />
                  {t('analytics.infrastructure.h2Stations', 'Stations H₂')} ({data.totalH2Stations})
                </span>
                <span className="font-medium">{data.utilizationH2}%</span>
              </div>
              <Progress value={data.utilizationH2} className="h-2" />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-green-600" />
                  {t('analytics.infrastructure.evChargers', 'Bornes EV')} ({data.totalEvChargers})
                </span>
                <span className="font-medium">{data.utilizationEv}%</span>
              </div>
              <Progress value={data.utilizationEv} className="h-2" />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('analytics.infrastructure.total10yOpex', 'OPEX Total (10 ans)')}
              </p>
              <p className="text-2xl font-bold">{formatCurrency(data.totalOpex10y)}</p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              {t('analytics.infrastructure.roiPositive', 'ROI Positif')}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InfrastructureEconomics;
