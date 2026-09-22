import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CheckCircle2, Clock } from "lucide-react";

interface ROIChartProps {
  data: { year: number; cumulative: number; breakeven: boolean }[];
  initialCapex?: number;
}

const formatCurrency = (value: number) => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  }
  if (absValue >= 1000) {
    return `${sign}$${Math.round(absValue / 1000)}K`;
  }
  return `${sign}$${Math.round(absValue)}`;
};

const ROIChart = ({ data, initialCapex }: ROIChartProps) => {
  const { t } = useTranslation();

  const breakevenYear = data.find(d => d.breakeven && d.year > 0)?.year;
  const finalValue = data[data.length - 1]?.cumulative || 0;
  
  // Calculate the actual initial investment (CAPEX) - either from prop or derive from data
  // If Year 1 cumulative is negative, the CAPEX is the absolute value of that minus the first year's net change
  const derivedCapex = initialCapex ?? (data.length >= 2 
    ? Math.abs(data[0]?.cumulative || 0) 
    : Math.abs(data[0]?.cumulative || 0));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{t('analytics.roi.title', 'Retour sur Investissement')}</CardTitle>
            <CardDescription>
              {t('analytics.roi.description', 'Flux de trésorerie cumulé de la transition')}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {breakevenYear ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {t('analytics.roi.breakeven', 'Rentabilité: An {{year}}', { year: breakevenYear })}
              </Badge>
            ) : data.length > 0 && (
              <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-300">
                <Clock className="w-3 h-3" />
                {t('analytics.roi.noBreakeven', 'Rentabilité non atteinte sur 10 ans')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="year" 
                tickFormatter={(v) => t('common.yearN', { n: v })}
                className="text-xs"
              />
              <YAxis 
                tickFormatter={formatCurrency}
                className="text-xs"
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => t('common.yearLabel', { n: label })}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              {breakevenYear && (
                <ReferenceLine 
                  x={breakevenYear} 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeDasharray="5 5"
                  label={{ value: t('analytics.roi.breakevenLabel', 'Breakeven'), position: 'top', fill: 'hsl(142, 76%, 36%)' }}
                />
              )}
              <Area
                type="monotone"
                dataKey="cumulative"
                name={t('analytics.roi.cumulative', 'Flux cumulé')}
                stroke="hsl(142, 76%, 36%)"
                fill="url(#roiGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">{t('analytics.roi.initialInvestment', 'Investissement initial')}</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(-derivedCapex)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">{t('analytics.roi.breakevenPeriod', 'Période de rentabilité')}</p>
            <p className="text-lg font-bold flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" />
              {breakevenYear ? `${breakevenYear} ${t('common.years', 'ans')}` : '-'}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">{t('analytics.roi.totalReturn', 'Retour total (10 ans)')}</p>
            <p className={`text-lg font-bold ${finalValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(finalValue)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ROIChart;
