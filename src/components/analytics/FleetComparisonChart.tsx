import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { FleetComparison } from "@/hooks/useEnhancedAnalytics";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

interface FleetComparisonChartProps {
  comparison: FleetComparison[];
}

const FleetComparisonChart = ({ comparison }: FleetComparisonChartProps) => {
  const { t } = useTranslation();

  if (comparison.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.comparison.title', 'Flotte Actuelle vs Cible')}</CardTitle>
          <CardDescription>
            {t('analytics.comparison.noData', 'Créez des scénarios pour voir la comparaison')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = comparison.map(c => ({
    name: c.category,
    current: c.current,
    target: c.target,
  }));

  const colors = {
    BEV: "hsl(142, 76%, 36%)",
    FCEV: "hsl(217, 91%, 60%)",
    Diesel: "hsl(0, 0%, 45%)",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('analytics.comparison.title', 'Flotte Actuelle vs Cible')}</CardTitle>
        <CardDescription>
          {t('analytics.comparison.description', 'Progression vers les objectifs de transition')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="name" type="category" className="text-xs" width={60} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar 
                dataKey="current" 
                name={t('analytics.comparison.current', 'Actuel')}
                fill="hsl(var(--muted-foreground))"
                radius={[0, 4, 4, 0]}
              />
              <Bar 
                dataKey="target" 
                name={t('analytics.comparison.target', 'Cible')}
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[entry.name as keyof typeof colors] || "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          {comparison.map((item) => (
            <div 
              key={item.category} 
              className="p-4 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{item.category}</span>
                <Badge 
                  variant={item.category === 'Diesel' ? 'destructive' : 'default'}
                  className="text-xs"
                >
                  {item.percentChange > 0 ? '+' : ''}{item.percentChange}%
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{item.current}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{item.target}</span>
                {item.difference !== 0 && (
                  <span className={`flex items-center gap-1 ${item.category === 'Diesel' ? 'text-green-600' : item.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.category === 'Diesel' ? (
                      item.difference < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    ) : (
                      item.difference > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FleetComparisonChart;
