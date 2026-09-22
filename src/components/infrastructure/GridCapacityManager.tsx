import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Zap, 
  Sun, 
  Wind, 
  Battery, 
  Clock, 
  TrendingDown,
  AlertTriangle,
  DollarSign 
} from 'lucide-react';
import { GridAnalysis } from '@/hooks/useInfrastructureTelematics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useState } from 'react';

interface GridCapacityManagerProps {
  gridAnalysis: GridAnalysis;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
};

// Energy prices by hour ($/kWh)
const hourlyPrices = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  price: i >= 7 && i <= 11 ? 0.18 : i >= 17 && i <= 21 ? 0.22 : 0.08,
  label: i >= 7 && i <= 11 ? 'peak' : i >= 17 && i <= 21 ? 'peak' : 'offpeak',
}));

const GridCapacityManager = ({ gridAnalysis }: GridCapacityManagerProps) => {
  const { t } = useTranslation();
  const [smartChargingEnabled, setSmartChargingEnabled] = useState(true);
  const [v2gEnabled, setV2gEnabled] = useState(false);
  const [renewableTarget, setRenewableTarget] = useState(30);

  // Calculate optimized vs standard charging distribution
  const chargingSchedule = Array.from({ length: 24 }, (_, i) => {
    const isOffPeak = i < 7 || i > 21;
    const standardLoad = gridAnalysis.totalPowerNeeded / 24;
    const optimizedLoad = smartChargingEnabled 
      ? (isOffPeak ? standardLoad * 1.8 : standardLoad * 0.4)
      : standardLoad;
    
    return {
      hour: i,
      standard: Math.round(standardLoad),
      optimized: Math.round(optimizedLoad),
      v2g: v2gEnabled && i >= 17 && i <= 20 ? -Math.round(gridAnalysis.v2gPotential * 0.3) : 0,
    };
  });

  // Calculate savings
  const standardCost = gridAnalysis.totalPowerNeeded * 0.15; // Average $/kWh
  const optimizedCost = chargingSchedule.reduce((sum, h) => {
    const price = hourlyPrices[h.hour].price;
    return sum + (h.optimized * price);
  }, 0);
  const dailySavings = standardCost - optimizedCost;
  const annualSavings = dailySavings * 365;

  return (
    <div className="space-y-4">
      {/* Power Overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                {t('infrastructure.grid.title', 'Gestion Capacité Réseau')}
              </CardTitle>
              <CardDescription>
                {t('infrastructure.grid.description', 'Optimisation de la demande électrique et intégration renouvelable')}
              </CardDescription>
            </div>
            {gridAnalysis.upgradeRequired && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('infrastructure.grid.upgradeRequired', 'Mise à niveau requise')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">{t('infrastructure.grid.dailyDemand', 'Demande quotidienne')}</span>
              </div>
              <p className="text-xl font-bold">{gridAnalysis.totalPowerNeeded.toLocaleString()} kWh</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">{t('infrastructure.grid.peakDemand', 'Puissance crête')}</span>
              </div>
              <p className="text-xl font-bold">{gridAnalysis.peakDemandKw.toLocaleString()} kW</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Sun className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">{t('infrastructure.grid.renewable', 'Renouvelable')}</span>
              </div>
              <p className="text-xl font-bold">{renewableTarget}%</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Battery className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">{t('infrastructure.grid.v2gPotential', 'Potentiel V2G')}</span>
              </div>
              <p className="text-xl font-bold">{gridAnalysis.v2gPotential} kW</p>
            </div>
          </div>

          {/* Smart Charging Controls */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('infrastructure.grid.smartCharging', 'Recharge Intelligente')}
              </h4>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="smartCharging" className="flex items-center gap-2">
                  {t('infrastructure.grid.enableSmartCharging', 'Éviter heures de pointe')}
                </Label>
                <Switch
                  id="smartCharging"
                  checked={smartChargingEnabled}
                  onCheckedChange={setSmartChargingEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="v2g" className="flex items-center gap-2">
                  {t('infrastructure.grid.enableV2G', 'Vehicle-to-Grid (V2G)')}
                </Label>
                <Switch
                  id="v2g"
                  checked={v2gEnabled}
                  onCheckedChange={setV2gEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{t('infrastructure.grid.renewableTarget', 'Objectif renouvelable')}: {renewableTarget}%</Label>
                <Slider
                  value={[renewableTarget]}
                  onValueChange={([v]) => setRenewableTarget(v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              {/* Savings Summary */}
              <div className="p-4 bg-green-100 dark:bg-green-950/30 rounded-lg mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {t('infrastructure.grid.potentialSavings', 'Économies potentielles')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('infrastructure.grid.daily', 'Quotidien')}</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(dailySavings)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('infrastructure.grid.annual', 'Annuel')}</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(annualSavings)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charging Schedule Chart */}
            <div>
              <h4 className="font-semibold mb-2">{t('infrastructure.grid.loadProfile', 'Profil de charge')}</h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chargingSchedule}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tickFormatter={(v) => `${v}h`} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="standard" 
                      name={t('infrastructure.grid.standard', 'Standard')}
                      fill="hsl(0, 0%, 60%)" 
                      opacity={0.5}
                    />
                    <Bar 
                      dataKey="optimized" 
                      name={t('infrastructure.grid.optimized', 'Optimisé')}
                      fill="hsl(142, 76%, 36%)" 
                    />
                    {v2gEnabled && (
                      <Bar 
                        dataKey="v2g" 
                        name="V2G"
                        fill="hsl(217, 91%, 60%)" 
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Energy Pricing */}
          <div className="mt-6">
            <h4 className="font-semibold mb-2">{t('infrastructure.grid.pricing', 'Tarification horaire')}</h4>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyPrices}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" tickFormatter={(v) => `${v}h`} className="text-xs" />
                  <YAxis tickFormatter={(v) => `$${v}`} className="text-xs" domain={[0, 0.25]} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}/kWh`, 'Prix']}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line 
                    type="stepAfter" 
                    dataKey="price" 
                    stroke="hsl(0, 84%, 60%)" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upgrade Cost */}
          {gridAnalysis.upgradeRequired && (
            <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-950/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                  {t('infrastructure.grid.upgradeNeeded', 'Mise à niveau réseau nécessaire')}
                </span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {t('infrastructure.grid.upgradeDesc', 'La puissance demandée dépasse la capacité standard. Coût estimé de mise à niveau:')}
                {' '}<span className="font-bold">{formatCurrency(gridAnalysis.estimatedUpgradeCost)}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GridCapacityManager;
