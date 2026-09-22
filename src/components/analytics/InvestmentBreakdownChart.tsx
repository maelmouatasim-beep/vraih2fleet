import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InvestmentBreakdownChartProps {
  vehicleCost: number;
  h2StationsCost: number;
  evChargersCost: number;
  operationsCost: number;
  showInfrastructure?: boolean;
  /** Indicates if data comes from calculated TCO results (true) or is estimated (false) */
  isCalculatedData?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const InvestmentBreakdownChart = ({
  vehicleCost,
  h2StationsCost,
  evChargersCost,
  operationsCost,
  showInfrastructure = true,
  isCalculatedData = false,
}: InvestmentBreakdownChartProps) => {
  const { t } = useTranslation();

  const totalInvestment = vehicleCost + h2StationsCost + evChargersCost + operationsCost;

  // Filter first, then calculate percentages based on filtered total
  const rawData = [
    { 
      name: t('analytics.investment.vehicles', 'Véhicules'), 
      value: vehicleCost,
    },
    { 
      name: t('analytics.investment.h2Stations', 'Stations H₂'), 
      value: h2StationsCost,
    },
    { 
      name: t('analytics.investment.evChargers', 'Bornes EV'), 
      value: evChargersCost,
    },
    { 
      name: t('analytics.investment.operations', 'Opérations & Maintenance'), 
      value: operationsCost,
    },
  ].filter(item => item.value > 0);

  // Calculate percentages after filtering (so they add up to 100%)
  const filteredTotal = rawData.reduce((sum, item) => sum + item.value, 0);
  const data = rawData.map(item => ({
    ...item,
    percent: filteredTotal > 0 ? Math.round((item.value / filteredTotal) * 100) : 0,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.name}</p>
          <p className="text-muted-foreground">{formatCurrency(data.value)}</p>
          <p className="text-sm text-primary font-semibold">{data.percent}{t('common.ofTotal', '% of total')}</p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    payload,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Use our pre-calculated percent from payload instead of Recharts' internal percent
    const displayPercent = payload?.percent || 0;

    return displayPercent >= 5 ? (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${displayPercent}%`}
      </text>
    ) : null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {t('analytics.investment.title', 'Répartition des investissements')}
            </CardTitle>
            <CardDescription>
              {t('analytics.investment.description', 'Ventilation du coût total par catégorie')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {showInfrastructure && (h2StationsCost > 0 || evChargersCost > 0) && (
              <Badge variant="outline" className="flex items-center gap-1">
                {t('analytics.investment.includesInfrastructure', 'Infrastructure incluse')}
              </Badge>
            )}
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={isCalculatedData ? "default" : "secondary"} 
                    className={`flex items-center gap-1 cursor-help ${
                      isCalculatedData 
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100" 
                        : "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100"
                    }`}
                  >
                    {isCalculatedData ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        {t('analytics.investment.calculated', 'Calculé')}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        {t('analytics.investment.estimated', 'Estimé')}
                      </>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm max-w-xs">
                    {isCalculatedData 
                      ? t('analytics.investment.calculatedTooltip', 'Données issues des résultats TCO calculés dans vos scénarios')
                      : t('analytics.investment.estimatedTooltip', 'Aucun TCO calculé. Créez des scénarios pour voir les valeurs réelles.')
                    }
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {totalInvestment > 0 ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={100}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: string) => <span className="text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {t('analytics.investment.totalInvestment', 'Investissement total')}
                </p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(totalInvestment)}</p>
              </div>

              <div className="space-y-3">
                {data.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.value)}</p>
                      <p className="text-xs text-muted-foreground">{item.percent}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            {t('analytics.investment.noData', 'Aucune donnée d\'investissement disponible')}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvestmentBreakdownChart;
