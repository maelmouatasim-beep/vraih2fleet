import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Fuel, Zap, Droplets, Truck, TrendingUp, TrendingDown, AlertTriangle, 
  Coins, Route, RotateCcw, Target, Layers, BarChart3, Sliders
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useRiskAnalysis, RiskParameter } from "@/hooks/useRiskAnalysis";
import { TransitionScenario } from "@/hooks/useEnhancedAnalytics";

interface RiskAnalysisPanelProps {
  scenarios: TransitionScenario[];
  baseTcoTotal: number;
  basePaybackYears: number;
  scenarioPrices?: {
    diesel: number;
    electricity: number;
    hydrogen: number;
    avgAnnualKm: number;
    avgVehicleCost: number;
    avgSubsidyPerVehicle: number;
    source: 'scenario' | 'portfolio';
    scenarioCount: number;
    activeFuelTypes: ('diesel' | 'electricity' | 'hydrogen')[];
  };
}

// Icon mapping for parameters
const parameterIcons: Record<string, React.ElementType> = {
  diesel: Fuel,
  electricity: Zap,
  hydrogen: Droplets,
  vehicleCost: Truck,
  subsidy: Coins,
  annualKm: Route,
};

// Color mapping for parameters
const parameterColors: Record<string, { text: string; bg: string }> = {
  diesel: { text: 'text-amber-600', bg: 'bg-amber-100' },
  electricity: { text: 'text-blue-600', bg: 'bg-blue-100' },
  hydrogen: { text: 'text-green-600', bg: 'bg-green-100' },
  vehicleCost: { text: 'text-purple-600', bg: 'bg-purple-100' },
  subsidy: { text: 'text-emerald-600', bg: 'bg-emerald-100' },
  annualKm: { text: 'text-orange-600', bg: 'bg-orange-100' },
};

// Preset configurations
interface Preset {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  variant: 'default' | 'destructive' | 'outline' | 'secondary';
}

const presets: Preset[] = [
  {
    id: 'energyUp',
    labelKey: 'analytics.risk.presets.energyUp',
    icon: <TrendingUp className="h-3 w-3" />,
    variant: 'outline',
  },
  {
    id: 'energyDown',
    labelKey: 'analytics.risk.presets.energyDown',
    icon: <TrendingDown className="h-3 w-3" />,
    variant: 'outline',
  },
  {
    id: 'subsidiesDown',
    labelKey: 'analytics.risk.presets.subsidiesDown',
    icon: <Coins className="h-3 w-3" />,
    variant: 'secondary',
  },
  {
    id: 'optimistic',
    labelKey: 'analytics.risk.presets.optimistic',
    icon: <TrendingDown className="h-3 w-3" />,
    variant: 'default',
  },
  {
    id: 'pessimistic',
    labelKey: 'analytics.risk.presets.pessimistic',
    icon: <AlertTriangle className="h-3 w-3" />,
    variant: 'destructive',
  },
];

const RiskAnalysisPanel = ({ scenarios, baseTcoTotal, basePaybackYears, scenarioPrices }: RiskAnalysisPanelProps) => {
  const { t } = useTranslation();
  const { result, variations, setVariation, applyPreset, resetAll, hasAnyVariation } = useRiskAnalysis({
    scenarios,
    baseTcoTotal,
    basePaybackYears,
    scenarioPrices,
  });

  // Prepare data for tornado chart
  const tornadoData = result.parameters.map(p => ({
    parameter: t(p.labelKey, p.label),
    positive: p.positiveImpact,
    negative: p.negativeImpact,
    impact: p.impactPercent,
    id: p.id,
  }));

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const formatVariation = (value: number) => {
    return value > 0 ? `+${value}%` : `${value}%`;
  };

  const formatParameterValue = (param: RiskParameter, adjustedValue: number) => {
    if (param.id === 'vehicleCost' || param.id === 'annualKm' || param.id === 'subsidy') {
      return `${Math.round(adjustedValue).toLocaleString()} ${param.unit}`;
    }
    return `$${adjustedValue.toFixed(2)} ${param.unit}`;
  };

  const formatBaseValue = (param: RiskParameter) => {
    if (param.id === 'vehicleCost' || param.id === 'annualKm' || param.id === 'subsidy') {
      return Math.round(param.baseValue).toLocaleString();
    }
    return `$${param.baseValue.toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('analytics.risk.title')}
            </CardTitle>
            <CardDescription>
              {t('analytics.risk.description')}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {t('analytics.risk.variation')}
            </Badge>
            {result.dataSource === 'scenario' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {t('analytics.risk.scenarioPrices')}
              </Badge>
            )}
            {result.dataSource === 'portfolio' && result.scenarioCount > 1 && (
              <Badge variant="outline" className="flex items-center gap-1 border-primary/50">
                <Layers className="w-3 h-3" />
                {t('analytics.risk.avgPrices', { count: result.scenarioCount })}
              </Badge>
            )}
            {result.riskLevel !== 'low' && (
              <Badge variant={result.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                {t(`analytics.risk.level.${result.riskLevel}`, result.riskLevel)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="auto" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto" className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {t('analytics.risk.tabs.auto')}
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1">
              <Sliders className="h-3 w-3" />
              {t('analytics.risk.tabs.manual')}
            </TabsTrigger>
          </TabsList>

          {/* Automatic Diagnostic Tab - Tornado Chart */}
          <TabsContent value="auto" className="space-y-6 pt-4">
            {/* Tornado Chart */}
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tornadoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number" 
                    domain={[-15, 15]}
                    tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                    className="text-xs"
                  />
                  <YAxis 
                    dataKey="parameter" 
                    type="category" 
                    width={140}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value > 0 ? '+' : ''}${value.toFixed(1)}%`, 
                      name === 'negative' ? t('analytics.risk.chart.decrease') : t('analytics.risk.chart.increase')
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="negative" name="negative" radius={[4, 0, 0, 4]}>
                    {tornadoData.map((entry, index) => (
                      <Cell key={`neg-${index}`} fill="hsl(142, 76%, 36%)" />
                    ))}
                  </Bar>
                  <Bar dataKey="positive" name="positive" radius={[0, 4, 4, 0]}>
                    {tornadoData.map((entry, index) => (
                      <Cell key={`pos-${index}`} fill="hsl(0, 84%, 60%)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Risk Ranking Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {result.parameters.map((param) => {
                const Icon = parameterIcons[param.id] || AlertTriangle;
                const colors = parameterColors[param.id] || { text: 'text-gray-600', bg: 'bg-gray-100' };
                
                return (
                  <div 
                    key={param.id}
                    className="p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded ${colors.bg}`}>
                        <Icon className={`h-4 w-4 ${colors.text}`} />
                      </div>
                      <span className="text-xs font-medium">#{param.riskRank}</span>
                    </div>
                    <p className="text-xs font-medium mb-1">{t(param.labelKey, param.label)}</p>
                    <p className="text-sm font-bold">{formatBaseValue(param)}</p>
                    <Badge 
                      variant={param.impactPercent > 6 ? "destructive" : param.impactPercent > 3 ? "secondary" : "outline"}
                      className="text-xs mt-1"
                    >
                      Impact: ±{param.impactPercent.toFixed(1)}%
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {t('analytics.risk.chart.favorable')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }} />
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {t('analytics.risk.chart.unfavorable')}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Manual Simulation Tab - Sliders */}
          <TabsContent value="manual" className="space-y-6 pt-4">
            {/* Presets Section */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('analytics.risk.presets.title')}
              </Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={preset.variant}
                    size="sm"
                    onClick={() => applyPreset(preset.id)}
                    className="flex items-center gap-1.5"
                  >
                    {preset.icon}
                    {t(preset.labelKey, preset.id)}
                  </Button>
                ))}
                {hasAnyVariation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAll}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t('analytics.risk.reset')}
                  </Button>
                )}
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {result.parameters.map((param) => {
                const Icon = parameterIcons[param.id] || AlertTriangle;
                const colors = parameterColors[param.id] || { text: 'text-gray-600', bg: 'bg-gray-100' };
                const variation = variations[param.id] || 0;
                const adjustedValue = param.baseValue * (1 + variation / 100);
                const minMax = param.id === 'subsidy' ? 50 : 30;
                
                return (
                  <div key={param.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${colors.bg}`}>
                          <Icon className={`h-4 w-4 ${colors.text}`} />
                        </div>
                        {t(param.labelKey, param.label)}
                      </Label>
                      <span className={`text-sm font-medium ${
                        variation === 0 ? 'text-muted-foreground' : 
                        variation > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatVariation(variation)}
                      </span>
                    </div>
                    <Slider
                      value={[variation]}
                      onValueChange={(v) => setVariation(param.id, v[0])}
                      min={-minMax}
                      max={minMax}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>-{minMax}%</span>
                      <span className="font-medium">
                        {formatParameterValue(param, adjustedValue)}
                        {variation !== 0 && (
                          <span className="text-muted-foreground/60 ml-1">
                            ({t('analytics.risk.parameters.base')}: {formatBaseValue(param)})
                          </span>
                        )}
                      </span>
                      <span>+{minMax}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Results Section */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-4">
                {t('analytics.risk.results.title')}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Adjusted TCO Total */}
                <div className={`p-4 rounded-lg border ${
                  result.isFavorable ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                }`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('analytics.risk.results.adjustedTco')}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(result.adjustedTco)}
                  </p>
                  <p className={`text-xs flex items-center gap-1 mt-1 ${
                    result.isFavorable ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {result.isFavorable ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {result.tcoChange >= 0 ? '+' : ''}{formatVariation(result.tcoChangePercent)} ({result.tcoChange >= 0 ? '+' : ''}{formatCurrency(Math.abs(result.tcoChange))})
                  </p>
                </div>

                {/* Payback Period */}
                <div className={`p-4 rounded-lg border ${
                  result.paybackChange <= 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                }`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('analytics.risk.results.paybackPeriod')}
                  </p>
                  <p className="text-2xl font-bold">
                    {result.adjustedPayback} {t('analytics.risk.results.years')}
                  </p>
                  <p className={`text-xs flex items-center gap-1 mt-1 ${
                    result.paybackChange <= 0 ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {result.paybackChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {result.paybackChange > 0 ? '+' : ''}{result.paybackChange} {t('analytics.risk.results.years')}
                  </p>
                </div>

                {/* Most Critical Risk */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t('analytics.risk.results.criticalRisk')}
                  </p>
                  {result.mostCriticalRisk ? (
                    <>
                      <p className="text-lg font-bold flex items-center gap-2">
                        {(() => {
                          const Icon = parameterIcons[result.mostCriticalRisk.id] || AlertTriangle;
                          return <Icon className="h-4 w-4" />;
                        })()}
                        {t(result.mostCriticalRisk.labelKey, result.mostCriticalRisk.label)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('analytics.risk.ranking.impact', { percent: result.mostCriticalRisk.impactPercent.toFixed(1) })}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-bold text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default RiskAnalysisPanel;
