import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Battery,
  Clock,
  DollarSign,
  Fuel,
  Gauge,
  TrendingUp,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { useInfrastructureTelematicsData } from '@/hooks/useInfrastructureTelematicsData';
import { DataBadge, BreakdownCard } from '@/components/shared/DataProvenance';
import type { DataSourceType } from '@/components/shared/DataProvenance';
import {
  calculateEVChargers,
  calculateH2Stations,
  calculateTotalInfrastructure,
  type ChargingSpeed,
  type H2StationCapacity,
} from '@/lib/calculations/infrastructure';

interface InfrastructureKPIsProps {
  evFleetSize: number;
  h2FleetSize: number;
  batteryCapacity: number;
  chargingSpeed: ChargingSpeed;
  chargingHours: number;
  h2DailyKg: number;
  h2StationCapacity: H2StationCapacity;
  h2CapexPerStation: number;
  h2LandPermits: number;
  gridUpgradeCosts?: number;
  scenarioId?: string | null;
  scenarioName?: string;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
};

const InfrastructureKPIs = ({
  evFleetSize,
  h2FleetSize,
  batteryCapacity,
  chargingSpeed,
  chargingHours,
  h2DailyKg,
  h2StationCapacity,
  h2CapexPerStation,
  h2LandPermits,
  gridUpgradeCosts = 0,
  scenarioId,
  scenarioName,
}: InfrastructureKPIsProps) => {
  const { t } = useTranslation();
  const [showAllKPIs, setShowAllKPIs] = useState(false);

  // Get real telematics data for capacity calculations
  const { 
    hasRealData, 
    geographicClusters 
  } = useInfrastructureTelematicsData();

  // Calculate EV chargers using single source function
  const evResult = calculateEVChargers({
    evFleetSize,
    batteryCapacity,
    chargingSpeed,
    hoursAvailable: chargingHours,
  });

  // Calculate H2 stations using single source function
  const h2Result = calculateH2Stations({
    h2FleetSize,
    dailyKgPerVehicle: h2DailyKg,
    stationCapacity: h2StationCapacity,
    capexPerStation: h2CapexPerStation,
    landAndPermits: h2LandPermits,
  });

  // Calculate total infrastructure
  const totalResult = calculateTotalInfrastructure({
    evResult,
    h2Result,
    gridUpgradeCosts,
  });

  // Calculate derived KPIs
  const totalVehicles = evFleetSize + h2FleetSize;
  const costPerVehicle = totalVehicles > 0 ? totalResult.totalCapex / totalVehicles : 0;
  const uptime = 97.5;

  // Utilization calculations
  const evUtilization = Math.min(95, Math.round((evFleetSize / Math.max(1, evResult.chargersNeeded * 3)) * 100));
  const h2Utilization = Math.min(85, Math.round((h2FleetSize / Math.max(1, h2Result.stationsNeeded * 15)) * 100));

  // Priority zones from telematics data
  const highPriorityZones = geographicClusters.filter(c => c.priority === 'high').length;

  // Determine data source for display
  const dataSource: DataSourceType = hasRealData ? 'real_data' : scenarioId ? 'user_input' : 'calculated';

  // Build breakdown items for the BreakdownCard
  const breakdownItems = totalResult.breakdown.map(item => ({
    label: item.label,
    value: formatCurrency(item.value),
    source: item.source as DataSourceType,
    formula: item.formula,
    tooltip: item.formula,
  }));

  return (
    <div className="space-y-4">
      {/* Main 4 KPIs - Always visible */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              {t('infrastructure.kpis.title', 'Infrastructure KPIs')}
              {hasRealData && (
                <Badge variant="outline" className="text-xs">
                  {t('infrastructure.telematicsConnected', 'Télématique')}
                </Badge>
              )}
            </CardTitle>
            {scenarioId && scenarioName && (
              <Link 
                to={`/dashboard/scenarios/${scenarioId}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {scenarioName}
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 4 Main KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Stations Required */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  {t('infrastructure.kpis.stationsRequired', 'Stations Required')}
                </span>
                <DataBadge type="calculated" sourceDetails={{ source: 'Calculated', formula: evResult.formula }} />
              </div>
              <div className="flex items-baseline gap-3">
                <div className="flex items-center gap-1">
                  <Fuel className="h-4 w-4 text-blue-500" />
                  <span className="text-xl font-bold">{h2Result.stationsNeeded}</span>
                  <span className="text-xs text-muted-foreground">H₂</span>
                </div>
                <div className="text-muted-foreground">|</div>
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-xl font-bold">{evResult.chargersNeeded}</span>
                  <span className="text-xs text-muted-foreground">EV</span>
                </div>
              </div>
            </div>

            {/* Total Investment */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  {t('infrastructure.kpis.totalInvestment', 'Total Investment')}
                </span>
                <DataBadge type="calculated" sourceDetails={{ source: 'Calculated', formula: 'H2 CAPEX + EV CAPEX + Grid' }} />
              </div>
              <span className="text-2xl font-bold">{formatCurrency(totalResult.totalCapex)}</span>
            </div>

            {/* Utilization */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  {t('infrastructure.kpis.utilization', 'Utilization')}
                </span>
                <DataBadge type="calculated" />
              </div>
              <div className="flex items-baseline gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xl font-bold">{h2Utilization}%</span>
                  <span className="text-xs text-muted-foreground">H₂</span>
                </div>
                <div className="text-muted-foreground">|</div>
                <div className="flex items-center gap-1">
                  <span className="text-xl font-bold">{evUtilization}%</span>
                  <span className="text-xs text-muted-foreground">EV</span>
                </div>
              </div>
            </div>

            {/* Priority Zones */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  {t('infrastructure.kpis.priorityZones', 'Priority Zones')}
                </span>
                <DataBadge type={hasRealData ? 'real_data' : 'calculated'} />
              </div>
              <span className="text-2xl font-bold">{highPriorityZones}</span>
            </div>
          </div>

          {/* Expandable Additional KPIs */}
          {showAllKPIs && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t animate-in slide-in-from-top-2 duration-200">
              {/* Uptime */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">{t('infrastructure.kpis.uptime', 'Uptime')}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-bold">{uptime}%</span>
                </div>
                <Progress value={uptime} className="mt-2 h-1.5" />
              </div>

              {/* EV Utilization Detail */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Battery className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">{t('infrastructure.kpis.evUtil', 'EV Utilization')}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-bold">{evUtilization}%</span>
                  {evUtilization > 80 && <Badge variant="destructive" className="text-xs">{t('common.high', 'High')}</Badge>}
                </div>
                <Progress value={evUtilization} className="mt-2 h-1.5" />
              </div>

              {/* H2 Utilization Detail */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Fuel className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">{t('infrastructure.kpis.h2Util', 'H₂ Utilization')}</span>
                </div>
                <span className="text-xl font-bold">{h2Utilization}%</span>
                <Progress value={h2Utilization} className="mt-2 h-1.5" />
              </div>

              {/* Cost per Vehicle */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">{t('infrastructure.kpis.costPerVehicle', 'Cost/Vehicle')}</span>
                </div>
                <span className="text-xl font-bold">{formatCurrency(costPerVehicle)}</span>
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllKPIs(!showAllKPIs)}
            className="w-full mt-4 text-xs"
          >
            {showAllKPIs ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                {t('common.hideDetails', 'Hide details')}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                {t('infrastructure.kpis.viewAllKPIs', 'View all KPIs')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Investment Breakdown Card - Collapsed by default */}
      <BreakdownCard
        title={t('infrastructure.summary.title', 'Total Infrastructure Investment')}
        total={{
          label: t('infrastructure.summary.totalCapex', 'Total CAPEX'),
          value: totalResult.totalCapex,
          unit: '',
        }}
        items={breakdownItems}
        icon={<DollarSign className="h-5 w-5" />}
        defaultExpanded={false}
      />

      {/* Financial Summary - Simplified */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-primary/10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">{t('infrastructure.kpis.totalCapex', 'Total CAPEX')}</span>
            </div>
            <DataBadge type="calculated" />
          </div>
          <span className="text-2xl font-bold">{formatCurrency(totalResult.totalCapex)}</span>
        </Card>
        <Card className="p-4 bg-secondary/50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{t('infrastructure.kpis.annualOpex', 'Annual OPEX')}</span>
            </div>
            <DataBadge type="calculated" />
          </div>
          <span className="text-2xl font-bold">{formatCurrency(totalResult.annualOpex)}</span>
        </Card>
      </div>
    </div>
  );
};

export default InfrastructureKPIs;
