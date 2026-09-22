import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Zap, MapPin, Clock, Activity } from 'lucide-react';
import { FeasibilityAlert, UsageSimulation } from '@/hooks/useInfrastructureTelematics';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface FeasibilityAlertsProps {
  alerts: FeasibilityAlert[];
  usageSimulation: UsageSimulation[];
  evChargers: number;
  h2Stations: number;
}

const severityIcons = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const severityColors = {
  critical: 'bg-red-100 dark:bg-red-950/30 border-red-500 text-red-700 dark:text-red-400',
  warning: 'bg-yellow-100 dark:bg-yellow-950/30 border-yellow-500 text-yellow-700 dark:text-yellow-400',
  info: 'bg-blue-100 dark:bg-blue-950/30 border-blue-500 text-blue-700 dark:text-blue-400',
};

const FeasibilityAlerts = ({ 
  alerts, 
  usageSimulation,
  evChargers,
  h2Stations,
}: FeasibilityAlertsProps) => {
  const { t } = useTranslation();

  // Calculate bottleneck detection
  const peakHours = usageSimulation.filter(u => u.evUtilization > 80 || u.h2Utilization > 80);
  const avgWaitTime = usageSimulation.reduce((sum, u) => sum + u.evWaitTime, 0) / 24;
  const maxQueueLength = Math.max(...usageSimulation.map(u => u.evQueueLength));

  // Infrastructure sufficiency check
  const isSufficient = peakHours.length < 6 && avgWaitTime < 15;

  return (
    <div className="space-y-4">
      {/* Feasibility Status */}
      <Card className={isSufficient ? 'border-green-500' : 'border-yellow-500'}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isSufficient ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              {t('infrastructure.feasibility.title', 'Validation Faisabilité')}
            </CardTitle>
            <Badge variant={isSufficient ? 'default' : 'secondary'}>
              {isSufficient 
                ? t('infrastructure.feasibility.sufficient', 'Capacité suffisante')
                : t('infrastructure.feasibility.attention', 'Attention requise')
              }
            </Badge>
          </div>
          <CardDescription>
            {t('infrastructure.feasibility.description', 'Vérification en temps réel de la capacité infrastructure')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <Zap className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{evChargers}</p>
              <p className="text-xs text-muted-foreground">{t('infrastructure.feasibility.evChargers', 'Bornes EV')}</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <Activity className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{h2Stations}</p>
              <p className="text-xs text-muted-foreground">{t('infrastructure.feasibility.h2Stations', 'Stations H₂')}</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <p className="text-2xl font-bold">{Math.round(avgWaitTime)} min</p>
              <p className="text-xs text-muted-foreground">{t('infrastructure.feasibility.avgWait', 'Attente moy.')}</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <MapPin className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <p className="text-2xl font-bold">{peakHours.length}h</p>
              <p className="text-xs text-muted-foreground">{t('infrastructure.feasibility.peakHours', 'Heures pointe')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Utilization Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('infrastructure.feasibility.simulation', 'Simulation Journalière')}</CardTitle>
          <CardDescription>
            {t('infrastructure.feasibility.simulationDesc', 'Utilisation et files d\'attente prévues sur 24h')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageSimulation}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(v) => `${v}h`}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(v) => `${v}:00`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="evUtilization"
                  name={t('infrastructure.feasibility.evUtil', 'Utilisation EV %')}
                  stroke="hsl(142, 76%, 36%)"
                  fill="hsl(142, 76%, 36%)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="h2Utilization"
                  name={t('infrastructure.feasibility.h2Util', 'Utilisation H₂ %')}
                  stroke="hsl(217, 91%, 60%)"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="evWaitTime"
                  name={t('infrastructure.feasibility.waitTime', 'Temps attente (min)')}
                  stroke="hsl(0, 84%, 60%)"
                  fill="hsl(0, 84%, 60%)"
                  fillOpacity={0.2}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {t('infrastructure.feasibility.alerts', 'Alertes & Recommandations')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => {
              const Icon = severityIcons[alert.severity];
              return (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${severityColors[alert.severity]}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold">{alert.title}</h4>
                      <p className="text-sm mt-1 opacity-90">{alert.description}</p>
                      <p className="text-sm mt-2 font-medium">
                        💡 {alert.recommendation}
                      </p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {alert.type}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FeasibilityAlerts;
