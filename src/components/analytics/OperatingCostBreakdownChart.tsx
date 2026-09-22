import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { AnnualOpexBreakdown } from "@/hooks/useEnhancedAnalytics";

interface OperatingCostBreakdownChartProps {
  data: AnnualOpexBreakdown[];
}

const chartConfig = {
  fuelCost: {
    label: "Fuel/Energy",
    color: "hsl(217, 91%, 60%)", // Blue
  },
  maintenanceCost: {
    label: "Maintenance",
    color: "hsl(31, 97%, 53%)", // Orange
  },
  insuranceCost: {
    label: "Insurance",
    color: "hsl(220, 9%, 46%)", // Gray
  },
  otherCost: {
    label: "Other",
    color: "hsl(262, 83%, 58%)", // Purple
  },
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const OperatingCostBreakdownChart = ({ data }: OperatingCostBreakdownChartProps) => {
  const { t } = useTranslation();

  // Translate config labels
  const translatedConfig = {
    fuelCost: {
      ...chartConfig.fuelCost,
      label: t('analytics.opex.fuel', 'Fuel/Energy'),
    },
    maintenanceCost: {
      ...chartConfig.maintenanceCost,
      label: t('analytics.opex.maintenance', 'Maintenance'),
    },
    insuranceCost: {
      ...chartConfig.insuranceCost,
      label: t('analytics.opex.insurance', 'Insurance'),
    },
    otherCost: {
      ...chartConfig.otherCost,
      label: t('analytics.opex.other', 'Other (downtime, telematics...)'),
    },
  };

  // Calculate totals for summary
  const totals = data.reduce(
    (acc, year) => ({
      fuel: acc.fuel + year.fuelCost,
      maintenance: acc.maintenance + year.maintenanceCost,
      insurance: acc.insurance + year.insuranceCost,
      other: acc.other + year.otherCost,
      total: acc.total + year.total,
    }),
    { fuel: 0, maintenance: 0, insurance: 0, other: 0, total: 0 }
  );

  const fuelPercent = totals.total > 0 ? Math.round((totals.fuel / totals.total) * 100) : 0;
  const maintenancePercent = totals.total > 0 ? Math.round((totals.maintenance / totals.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('analytics.opex.breakdown', 'Operating Cost Breakdown')}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {formatCurrency(totals.total)} {t('analytics.opex.total', 'total')}
          </span>
        </CardTitle>
        <CardDescription>
          {t('analytics.opex.description', 'Annual breakdown: {{fuel}}% fuel, {{maintenance}}% maintenance', {
            fuel: fuelPercent,
            maintenance: maintenancePercent,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={translatedConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="year"
                tickFormatter={(value) => `${t('common.year', 'Year')} ${value}`}
                className="text-xs"
              />
              <YAxis tickFormatter={formatCurrency} className="text-xs" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span>
                        {translatedConfig[name as keyof typeof translatedConfig]?.label || name}:{' '}
                        {formatCurrency(value as number)}
                      </span>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="fuelCost"
                stackId="a"
                fill={chartConfig.fuelCost.color}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="maintenanceCost"
                stackId="a"
                fill={chartConfig.maintenanceCost.color}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="insuranceCost"
                stackId="a"
                fill={chartConfig.insuranceCost.color}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="otherCost"
                stackId="a"
                fill={chartConfig.otherCost.color}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default OperatingCostBreakdownChart;
