import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface FleetMixCardProps {
  bevCount: number;
  fcevCount: number;
  dieselCount: number;
  totalVehicles: number;
}

const COLORS = {
  bev: "hsl(var(--chart-1))",
  fcev: "hsl(var(--chart-2))",
  diesel: "hsl(var(--chart-3))",
};

const FleetMixCard = ({ bevCount, fcevCount, dieselCount, totalVehicles }: FleetMixCardProps) => {
  const { t } = useTranslation();

  const zePercent = totalVehicles > 0 
    ? Math.round(((bevCount + fcevCount) / totalVehicles) * 100) 
    : 0;

  const chartData = [
    { name: 'BEV', value: bevCount, color: COLORS.bev },
    { name: 'FCEV', value: fcevCount, color: COLORS.fcev },
    { name: 'Diesel', value: dieselCount, color: COLORS.diesel },
  ].filter(d => d.value > 0);

  const hasData = chartData.length > 0;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('analytics.kpis.fleetMix', 'Fleet Mix')}
        </CardTitle>
        <Truck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Mini Pie Chart */}
          <div className="h-14 w-14 flex-shrink-0">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={12}
                    outerRadius={26}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">-</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold">{totalVehicles}</div>
            <p className="text-xs text-muted-foreground truncate">
              {bevCount} BEV · {fcevCount} FCEV · {dieselCount} Diesel
            </p>
          </div>
        </div>

        {/* ZE Badge */}
        {totalVehicles > 0 && (
          <Badge 
            variant={zePercent >= 80 ? "default" : zePercent >= 50 ? "secondary" : "outline"}
            className="absolute top-2 right-2 text-xs"
          >
            {zePercent}% ZE
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

export default FleetMixCard;
