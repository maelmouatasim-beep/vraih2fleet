import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Leaf, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Clock,
  Navigation,
  PiggyBank,
  Building2,
  Calculator
} from "lucide-react";
import { KPIMetrics } from "@/hooks/useEnhancedAnalytics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FleetMixCard from "./FleetMixCard";

interface KPIDashboardProps {
  kpis: KPIMetrics;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
};

const formatCo2 = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} kt`;
  }
  return `${value} t`;
};

const MetricCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  subtitle,
  badge,
  badgeVariant = "default",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive";
}) => (
  <Card className="relative overflow-hidden">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
      {trend && (
        <p className={`text-xs flex items-center gap-1 mt-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
          {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend}
        </p>
      )}
      {badge && (
        <Badge variant={badgeVariant} className="absolute top-2 right-2 text-xs">
          {badge}
        </Badge>
      )}
    </CardContent>
  </Card>
);

const KPIDashboard = ({ kpis }: KPIDashboardProps) => {
  const { t } = useTranslation();

  // Traceability info
  const hasTraceability = kpis.sourceScenarioCount > 0;
  const traceabilityText = hasTraceability 
    ? t('analytics.kpis.basedOn', 'Based on {{count}} scenarios: {{names}}', {
        count: kpis.sourceScenarioCount,
        names: kpis.sourceScenarioNames.slice(0, 3).join(', ') + (kpis.sourceScenarioNames.length > 3 ? '...' : '')
      })
    : t('analytics.kpis.noData', 'No scenario with calculated TCO');

  const renderMetricWithTooltip = (metric: React.ReactNode, tooltipText: string) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{metric}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const formatKm = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M km`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K km`;
    }
    return `${value} km`;
  };

  return (
    <div className="space-y-4">
      {/* Primary KPIs - Financial Focus */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {renderMetricWithTooltip(
          <MetricCard
            title={t('analytics.kpis.tcoTotal', 'TCO Total')}
            value={formatCurrency(kpis.totalTcoSum)}
            icon={DollarSign}
            subtitle={kpis.avgTcoPerVehicle > 0 
              ? `${formatCurrency(kpis.avgTcoPerVehicle)} / ${t('common.vehicle', 'vehicle')}`
              : undefined}
          />,
          traceabilityText
        )}
        {renderMetricWithTooltip(
          <MetricCard
            title={t('analytics.kpis.tcoSavings', 'TCO Savings')}
            value={kpis.totalTcoSavings > 0 ? formatCurrency(kpis.totalTcoSavings) : '-'}
            icon={PiggyBank}
            trend={kpis.totalTcoSavings > 0 ? t('analytics.kpis.vsDiesel', 'vs diesel baseline') : undefined}
            trendUp={true}
            badge={kpis.totalTcoSavings > 500000 ? t('common.excellent', 'Excellent') : undefined}
            badgeVariant="default"
          />,
          traceabilityText
        )}
        {renderMetricWithTooltip(
          <MetricCard
            title={t('analytics.kpis.capex', 'CAPEX')}
            value={kpis.totalCapex > 0 ? formatCurrency(kpis.totalCapex) : '-'}
            icon={Building2}
            subtitle={kpis.aggregationLabel || t('analytics.kpis.initialInvestment', 'Initial investment')}
          />,
          traceabilityText
        )}
        {renderMetricWithTooltip(
          <MetricCard
            title={t('analytics.kpis.opex', 'OPEX')}
            value={kpis.totalOpex > 0 ? formatCurrency(kpis.totalOpex) : '-'}
            icon={Calculator}
            subtitle={kpis.aggregationLabel || t('analytics.kpis.operatingCosts', 'Operating costs')}
          />,
          traceabilityText
        )}
      </div>

      {/* Secondary KPIs - Operational & Environmental */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FleetMixCard
          bevCount={kpis.bevCount}
          fcevCount={kpis.fcevCount}
          dieselCount={kpis.dieselCount}
          totalVehicles={kpis.totalVehicles}
        />
        {renderMetricWithTooltip(
          <MetricCard
            title={t('analytics.kpis.co2Reduction', 'CO₂ Reduction')}
            value={formatCo2(kpis.co2Reduction)}
            icon={Leaf}
            trend={kpis.co2ReductionPercent > 0 ? `${kpis.co2ReductionPercent}% ${t('analytics.kpis.vsDiesel', 'vs diesel')}` : undefined}
            trendUp={true}
            badge={kpis.co2ReductionPercent > 50 ? t('common.excellent', 'Excellent') : undefined}
            badgeVariant="default"
          />,
          traceabilityText
        )}
        {renderMetricWithTooltip(
          <MetricCard
            title={t('analytics.kpis.costPerKm', 'Cost per km')}
            value={kpis.tcoPerKm > 0 ? `$${kpis.tcoPerKm.toFixed(2)}/km` : '-'}
            icon={Navigation}
            subtitle={kpis.totalFleetKm > 0 ? formatKm(kpis.totalFleetKm) : undefined}
          />,
          traceabilityText
        )}
        {renderMetricWithTooltip(
          <MetricCard
            title={t('analytics.kpis.paybackPeriod', 'Payback Period')}
            value={kpis.avgPaybackYears > 0 ? `${kpis.avgPaybackYears} ${t('common.years', 'years')}` : '-'}
            icon={Clock}
            badge={kpis.avgPaybackYears > 0 && kpis.avgPaybackYears < 5 ? t('analytics.kpis.fast', 'Fast') : undefined}
            badgeVariant="secondary"
          />,
          traceabilityText
        )}
      </div>
    </div>
  );
};

export default KPIDashboard;
