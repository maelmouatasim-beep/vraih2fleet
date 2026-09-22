import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
} from "recharts";
import { CostProjection } from "@/hooks/useEnhancedAnalytics";

interface CostProjectionsChartProps {
  projections: CostProjection[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value}`;
};

const CostProjectionsChart = ({ projections }: CostProjectionsChartProps) => {
  const { t } = useTranslation();

  const data5y = projections.slice(0, 5);
  const data10y = projections;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('analytics.projections.title', 'Projections de Coûts')}</CardTitle>
        <CardDescription>
          {t('analytics.projections.description', 'Comparaison TCO par motorisation sur 5 et 10 ans')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="10y">
          <TabsList className="mb-4">
            <TabsTrigger value="5y">{t('analytics.projections.5years', '5 ans')}</TabsTrigger>
            <TabsTrigger value="10y">{t('analytics.projections.10years', '10 ans')}</TabsTrigger>
            <TabsTrigger value="savings">{t('analytics.projections.savings', 'Économies')}</TabsTrigger>
          </TabsList>

          <TabsContent value="5y">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data5y}>
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
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="dieselTco"
                    name={t('analytics.projections.diesel', 'Diesel')}
                    stroke="hsl(0, 0%, 45%)"
                    fill="hsl(0, 0%, 45%)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="bevTco"
                    name={t('analytics.projections.bev', 'BEV')}
                    stroke="hsl(142, 76%, 36%)"
                    fill="hsl(142, 76%, 36%)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="fcevTco"
                    name={t('analytics.projections.fcev', 'FCEV')}
                    stroke="hsl(217, 91%, 60%)"
                    fill="hsl(217, 91%, 60%)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="10y">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data10y}>
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
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="dieselTco"
                    name={t('analytics.projections.diesel', 'Diesel')}
                    stroke="hsl(0, 0%, 45%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(0, 0%, 45%)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bevTco"
                    name={t('analytics.projections.bev', 'BEV')}
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(142, 76%, 36%)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fcevTco"
                    name={t('analytics.projections.fcev', 'FCEV')}
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(217, 91%, 60%)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mixedTco"
                    name={t('analytics.projections.mixed', 'Mixte')}
                    stroke="hsl(280, 70%, 50%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(280, 70%, 50%)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="savings">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data10y}>
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
                  <Legend />
                  <Bar
                    dataKey="cumulativeSavings"
                    name={t('analytics.projections.cumulativeSavings', 'Économies cumulées')}
                    fill="hsl(142, 76%, 36%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CostProjectionsChart;
