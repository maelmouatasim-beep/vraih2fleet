import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TCOResult, Region, Scenario } from '@/lib/calculations/types';
import { formatCurrency, formatCurrencyPerUnit, getCurrencyLabel } from '@/lib/currency';
import { PDFDownloadButton } from '@/components/reports';
import { useTranslation } from 'react-i18next';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  DollarSign,
  TrendingDown,
  Leaf,
  Zap,
  Fuel,
  Building2,
  Download,
  FileText,
  Clock,
  Shield,
  Radio,
  Thermometer,
  BadgeDollarSign,
  Settings2,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { CalculationParametersCard } from './CalculationParametersCard';
import { BaselineComparisonCard } from './BaselineComparisonCard';
import { BudgetConstraintInput } from './BudgetConstraintInput';
import { ScenarioRecommendations } from './ScenarioRecommendations';

interface TCOResultsProps {
  result: TCOResult;
  scenario?: Scenario | null;
  region?: Region;
  scenarioId?: string;
  scenarioName?: string;
  analysisYears?: number;
  discountRate?: number;
  maxBudget?: number | null;
  onBudgetChange?: (budget: number | null) => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  isExportingPDF?: boolean;
}

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(1);
};

const COLORS = {
  diesel: '#f97316',
  ev: '#22c55e',
  hydrogen: '#3b82f6',
  capex: '#8b5cf6',       // Violet - CAPEX
  opex: '#ec4899',        // Legacy - kept for backward compatibility
  fuel: '#f97316',        // Orange - Fuel/Energy
  maintenance: '#0ea5e9', // Sky blue - Maintenance
  insurance: '#6366f1',   // Indigo - Insurance
  advanced: '#ec4899',    // Pink - Advanced costs (Downtime/Grid/Telematics)
  credits: '#22c55e',     // Green - Carbon credits (revenue)
};

export function TCOResults({ result, scenario, region = 'Canada', scenarioId, scenarioName, analysisYears = 10, discountRate = 5, maxBudget, onBudgetChange, onExportPDF, onExportExcel, isExportingPDF }: TCOResultsProps) {
  const { t } = useTranslation();
  
  // Currency formatting helper bound to the current region
  const fmtCurrency = (value: number) => formatCurrency(value, region);
  const fmtCurrencyPerKm = (value: number) => formatCurrencyPerUnit(value, region, '/km', 3);
  const currencyLabel = getCurrencyLabel(region);

  const chartConfig = {
    capex: { label: 'CAPEX', color: COLORS.capex },
    opex: { label: 'OPEX', color: COLORS.opex },
    fuel: { label: t('scenarios.results.chart.fuel', 'Fuel/Energy'), color: COLORS.fuel },
    maintenance: { label: t('scenarios.results.chart.maintenance', 'Maintenance'), color: COLORS.maintenance },
    insurance: { label: t('scenarios.results.chart.insurance', 'Insurance'), color: COLORS.insurance },
    advanced: { label: t('scenarios.results.chart.advanced', 'Downtime/Grid/Telematics'), color: COLORS.advanced },
    credits: { label: t('scenarios.results.chart.credits', 'Carbon Credits'), color: COLORS.credits },
    diesel: { label: 'Diesel', color: COLORS.diesel },
    ev: { label: t('scenarios.results.electric', 'Electric'), color: COLORS.ev },
    hydrogen: { label: t('scenarios.results.hydrogen', 'Hydrogen'), color: COLORS.hydrogen },
  };

  // Prepare enhanced chart data with detailed breakdown
  // SINGLE SOURCE OF TRUTH: All values come from advancedCosts (user form data)
  // No automatic fallbacks - if not configured in form, value is 0
  const yearlyData = result.yearlyBreakdown.map((y) => {
    // Advanced costs total (excluding insurance which is shown separately)
    const advancedNonInsurance = 
      (y.advancedCosts?.downtime || 0) + 
      (y.advancedCosts?.telematics || 0) +
      (y.advancedCosts?.gridDemand || 0) +
      (y.advancedCosts?.fcStackReplacement || 0);
    
    return {
      year: `${t('scenarios.results.year', 'Year')} ${y.year}`,
      capex: y.capex,
      // No fallbacks - use exact values from calculation engine
      fuel: y.opexBreakdown?.fuel || 0,
      maintenance: y.opexBreakdown?.maintenance || 0,
      // Insurance comes from advancedCosts (form data), not from opexBreakdown
      insurance: y.advancedCosts?.insurance || 0,
      // Advanced costs WITHOUT insurance (already counted above)
      advanced: advancedNonInsurance,
      credits: y.advancedCosts?.carbonCredits || 0,
      opex: y.opex,  // Keep for backward compatibility
      total: y.totalCost,
      cumulative: y.cumulativeCost,
    };
  });

  // Defensive access to byVehicleType with fallbacks
  const defaultVehicleData = { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 };
  const dieselData = result.byVehicleType?.diesel ?? defaultVehicleData;
  const evData = result.byVehicleType?.ev ?? defaultVehicleData;
  const hydrogenData = result.byVehicleType?.hydrogen ?? defaultVehicleData;

  const fleetData = [
    { name: 'Diesel', value: dieselData.count, color: COLORS.diesel },
    { name: t('scenarios.results.electric', 'Electric'), value: evData.count, color: COLORS.ev },
    { name: t('scenarios.results.hydrogen', 'Hydrogen'), value: hydrogenData.count, color: COLORS.hydrogen },
  ].filter((d) => d.value > 0);

  const co2Data = [
    { name: 'Diesel', value: dieselData.co2, color: COLORS.diesel },
    { name: t('scenarios.results.electric', 'Electric'), value: evData.co2, color: COLORS.ev },
    { name: t('scenarios.results.hydrogen', 'Hydrogen'), value: hydrogenData.co2, color: COLORS.hydrogen },
  ].filter((d) => d.value > 0);

  // Calculate CAPEX breakdown
  const vehicleCapex = dieselData.capex + evData.capex + hydrogenData.capex;
  const infraCapex = result.totalInfrastructureCost ?? 0;
  const totalCapex = vehicleCapex + infraCapex;
  const totalVehicles = dieselData.count + evData.count + hydrogenData.count;

  return (
    <div className="space-y-6">
      {/* TCO Disclaimer */}
      <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/30 rounded-lg p-4 flex gap-3">
        <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {t('scenarios.results.disclaimer', 'TCO estimates are for planning purposes only. Actual costs may vary based on local conditions. For critical financial decisions, consult an expert.')}{' '}
          <a href="/methodology" className="underline font-medium hover:text-amber-800">{t('scenarios.results.viewMethodology', 'View methodology')}</a>
        </p>
      </div>

      {/* Calculation Parameters Card */}
      <CalculationParametersCard 
        result={result} 
        region={region} 
        analysisYears={analysisYears}
        discountRate={discountRate}
      />

      {/* Baseline Comparison Card */}
      <BaselineComparisonCard result={result} region={region} />

      {/* Budget Constraint Input */}
      {onBudgetChange && (
        <BudgetConstraintInput
          currentCapex={totalCapex}
          maxBudget={maxBudget ?? null}
          onBudgetChange={onBudgetChange}
          region={region}
        />
      )}

      {/* Intelligent Recommendations */}
      <ScenarioRecommendations
        result={result}
        scenario={scenario ?? null}
        region={region}
        maxBudget={maxBudget ?? null}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">{t('scenarios.results.totalCapex', 'Total CAPEX')}</span>
              <Badge variant="outline" className="text-xs ml-auto">{currencyLabel}</Badge>
            </div>
            <p className="text-2xl font-bold">{fmtCurrency(totalCapex)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('scenarios.results.vehiclesPlusInfra', 'Vehicles + Infrastructure')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm">{t('scenarios.results.totalOpex', 'Total OPEX')}</span>
            </div>
            <p className="text-2xl font-bold">{fmtCurrency(result.opexTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">{t('scenarios.results.tcoTotal', 'TCO Total')}</span>
            </div>
            <p className="text-2xl font-bold">{fmtCurrency(result.tcoTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Leaf className="h-4 w-4" />
              <span className="text-sm">{t('scenarios.results.co2Savings', 'CO₂ Savings')}</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {result.co2SavingsPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CAPEX Breakdown Card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {t('scenarios.results.capexBreakdown', 'CAPEX Breakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('scenarios.results.vehicles', 'Vehicles')}</p>
              <p className="text-lg font-semibold">{fmtCurrency(vehicleCapex)}</p>
              <p className="text-xs text-muted-foreground">{totalVehicles} {t('common.vehicles', 'vehicles')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('scenarios.results.h2Stations', 'H₂ Stations')}</p>
              <p className="text-lg font-semibold">{fmtCurrency(result.h2StationsCost)}</p>
              <p className="text-xs text-muted-foreground">{result.h2Stations} {t('common.stations', 'stations')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('scenarios.results.evChargers', 'EV Chargers')}</p>
              <p className="text-lg font-semibold">{fmtCurrency(result.chargingStationsCost)}</p>
              <p className="text-xs text-muted-foreground">{result.chargingStations} {t('common.chargers', 'chargers')}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 -m-2">
              <p className="text-xs text-muted-foreground">{t('scenarios.results.totalCapex', 'Total CAPEX')}</p>
              <p className="text-lg font-bold text-primary">{fmtCurrency(totalCapex)}</p>
              <p className="text-xs text-muted-foreground">{t('scenarios.results.investmentTotal', 'Investment total')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t('scenarios.results.tcoPerKm', 'TCO per km')}</p>
            <p className="text-lg font-semibold">{fmtCurrencyPerKm(result.tcoPerKm)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">NPV</p>
            <p className="text-lg font-semibold">{fmtCurrency(Math.abs(result.npv))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t('scenarios.results.paybackPeriod', 'Payback Period')}</p>
            <p className="text-lg font-semibold">
              {result.paybackPeriodYears ? `${result.paybackPeriodYears.toFixed(1)} ${t('common.yrs', 'yrs')}` : 'N/A'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t('scenarios.results.co2Total', 'CO₂ Total')}</p>
            <p className="text-lg font-semibold">{formatNumber(result.co2Total)} t</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t('scenarios.results.co2Avoided', 'CO₂ Avoided')}</p>
            <p className="text-lg font-semibold text-green-600">{formatNumber(result.co2Savings)} t</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="costs" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="costs">{t('scenarios.results.tabs.costs', 'Costs')}</TabsTrigger>
          <TabsTrigger value="advanced">{t('scenarios.results.tabs.advanced', 'Advanced')}</TabsTrigger>
          <TabsTrigger value="emissions">{t('scenarios.results.tabs.emissions', 'CO₂ Emissions')}</TabsTrigger>
          <TabsTrigger value="fleet">{t('scenarios.results.tabs.fleet', 'Fleet Mix')}</TabsTrigger>
          <TabsTrigger value="infrastructure">{t('scenarios.results.tabs.infrastructure', 'Infrastructure')}</TabsTrigger>
        </TabsList>

        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('scenarios.results.annualCostEvolution', 'Annual Cost Evolution')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      
                      const grossCost = (data.capex || 0) + (data.fuel || 0) + (data.maintenance || 0) + 
                                        (data.insurance || 0) + (data.advanced || 0);
                      const netCost = grossCost - (data.credits || 0);
                      
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-md">
                          <p className="font-medium mb-2">{label}</p>
                          <div className="space-y-1 text-sm">
                            {data.capex > 0 && (
                              <div className="flex justify-between gap-4">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.capex }} />
                                  CAPEX
                                </span>
                                <span className="font-mono">{fmtCurrency(data.capex)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.fuel }} />
                                {t('scenarios.results.chart.fuel', 'Fuel/Energy')}
                              </span>
                              <span className="font-mono">{fmtCurrency(data.fuel || 0)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.maintenance }} />
                                {t('scenarios.results.chart.maintenance', 'Maintenance')}
                              </span>
                              <span className="font-mono">{fmtCurrency(data.maintenance || 0)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.insurance }} />
                                {t('scenarios.results.chart.insurance', 'Insurance')}
                              </span>
                              <span className="font-mono">{fmtCurrency(data.insurance || 0)}</span>
                            </div>
                            {data.advanced > 0 && (
                              <div className="flex justify-between gap-4">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.advanced }} />
                                  {t('scenarios.results.chart.advanced', 'Downtime/Grid/Telematics')}
                                </span>
                                <span className="font-mono">{fmtCurrency(data.advanced)}</span>
                              </div>
                            )}
                            <div className="border-t pt-1 mt-1 flex justify-between gap-4 font-medium">
                              <span>{t('scenarios.results.chart.subtotal', 'Gross Total')}</span>
                              <span className="font-mono">{fmtCurrency(grossCost)}</span>
                            </div>
                            {data.credits > 0 && (
                              <>
                                <div className="flex justify-between gap-4 text-green-600">
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.credits }} />
                                    {t('scenarios.results.chart.credits', 'Carbon Credits')}
                                  </span>
                                  <span className="font-mono">-{fmtCurrency(data.credits)}</span>
                                </div>
                                <div className="border-t pt-1 mt-1 flex justify-between gap-4 font-bold">
                                  <span>{t('scenarios.results.chart.netTotal', 'Net Total')}</span>
                                  <span className="font-mono">{fmtCurrency(netCost)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="capex"
                    name="CAPEX"
                    stackId="costs"
                    stroke={COLORS.capex}
                    fill={COLORS.capex}
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="fuel"
                    name={t('scenarios.results.chart.fuel', 'Fuel/Energy')}
                    stackId="costs"
                    stroke={COLORS.fuel}
                    fill={COLORS.fuel}
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="maintenance"
                    name={t('scenarios.results.chart.maintenance', 'Maintenance')}
                    stackId="costs"
                    stroke={COLORS.maintenance}
                    fill={COLORS.maintenance}
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="insurance"
                    name={t('scenarios.results.chart.insurance', 'Insurance')}
                    stackId="costs"
                    stroke={COLORS.insurance}
                    fill={COLORS.insurance}
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="advanced"
                    name={t('scenarios.results.chart.advanced', 'Downtime/Grid/Telematics')}
                    stackId="costs"
                    stroke={COLORS.advanced}
                    fill={COLORS.advanced}
                    fillOpacity={0.7}
                  />
                </AreaChart>
              </ChartContainer>
              
              {/* Chart Legend */}
              <div className="flex flex-wrap gap-4 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.capex }} />
                  <span>CAPEX ({t('scenarios.results.chart.vehiclesInfra', 'Vehicles + Infrastructure')})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.fuel }} />
                  <span>{t('scenarios.results.chart.fuel', 'Fuel/Energy')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.maintenance }} />
                  <span>{t('scenarios.results.chart.maintenance', 'Maintenance')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.insurance }} />
                  <span>{t('scenarios.results.chart.insurance', 'Insurance')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.advanced }} />
                  <span>{t('scenarios.results.chart.advanced', 'Downtime/Grid/Telematics')}</span>
                </div>
                {result.carbonCreditsValue > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.credits }} />
                    <span>{t('scenarios.results.chart.credits', 'Carbon Credits')} ({t('scenarios.results.chart.revenue', 'Revenue')})</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('scenarios.results.cumulativeCost', 'Cumulative Cost')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <AreaChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Costs Tab */}
        <TabsContent value="advanced" className="space-y-4">
          {/* Check if any advanced costs exist */}
          {(result.downtimeCost > 0 || result.insuranceCost > 0 || result.telematicsCost > 0 || 
            result.gridDemandCost > 0 || result.carbonCreditsValue > 0 || result.coldWeatherImpact > 0) ? (
            <>
              {/* Summary Card */}
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    {t('scenarios.results.advancedCostsSummary', 'Advanced Costs - Summary')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('scenarios.results.totalOperationalCosts', 'Total operational costs')}</p>
                      <p className="text-lg font-semibold text-destructive">
                        +{fmtCurrency(
                          (result.downtimeCost || 0) + 
                          (result.insuranceCost || 0) + 
                          (result.telematicsCost || 0) + 
                          (result.gridDemandCost || 0) + 
                          (result.coldWeatherImpact || 0)
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('scenarios.results.carbonCreditsRevenue', 'Carbon credits (revenue)')}</p>
                      <p className="text-lg font-semibold text-green-600">
                        -{fmtCurrency(result.carbonCreditsValue || 0)}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 -m-2">
                      <p className="text-xs text-muted-foreground">{t('scenarios.results.netTcoImpact', 'Net impact on TCO')}</p>
                      <p className={`text-lg font-bold ${
                        ((result.downtimeCost || 0) + (result.insuranceCost || 0) + (result.telematicsCost || 0) + 
                         (result.gridDemandCost || 0) + (result.coldWeatherImpact || 0) - (result.carbonCreditsValue || 0)) > 0 
                          ? 'text-destructive' : 'text-green-600'
                      }`}>
                        {((result.downtimeCost || 0) + (result.insuranceCost || 0) + (result.telematicsCost || 0) + 
                          (result.gridDemandCost || 0) + (result.coldWeatherImpact || 0) - (result.carbonCreditsValue || 0)) > 0 ? '+' : ''}
                        {fmtCurrency(
                          (result.downtimeCost || 0) + (result.insuranceCost || 0) + (result.telematicsCost || 0) + 
                          (result.gridDemandCost || 0) + (result.coldWeatherImpact || 0) - (result.carbonCreditsValue || 0)
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Downtime */}
                {result.downtimeCost > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-5 w-5 text-orange-500" />
                        <span className="font-medium">{t('scenarios.results.downtime', 'Downtime')}</span>
                      </div>
                      <p className="text-2xl font-bold text-destructive">+{fmtCurrency(result.downtimeCost)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('scenarios.results.downtimeDesc', 'Breakdowns, preventive maintenance')}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Insurance */}
                {result.insuranceCost > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">{t('scenarios.results.insurance', 'Insurance')}</span>
                      </div>
                      <p className="text-2xl font-bold text-destructive">+{fmtCurrency(result.insuranceCost)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('scenarios.results.insuranceDesc', 'Annual fleet premiums')}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Telematics */}
                {result.telematicsCost > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Radio className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">{t('scenarios.results.telematics', 'Telematics')}</span>
                      </div>
                      <p className="text-2xl font-bold text-destructive">+{fmtCurrency(result.telematicsCost)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('scenarios.results.telematicsDesc', 'Subscriptions & devices')}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Grid Demand */}
                {result.gridDemandCost > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">{t('scenarios.results.gridDemand', 'Grid Demand')}</span>
                      </div>
                      <p className="text-2xl font-bold text-destructive">+{fmtCurrency(result.gridDemandCost)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('scenarios.results.gridDemandDesc', 'Grid connection upgrade')}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Cold Weather Impact */}
                {result.coldWeatherImpact > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Thermometer className="h-5 w-5 text-cyan-500" />
                        <span className="font-medium">{t('scenarios.results.coldWeather', 'Cold Weather')}</span>
                      </div>
                      <p className="text-2xl font-bold text-destructive">+{fmtCurrency(result.coldWeatherImpact)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('scenarios.results.coldWeatherDesc', 'Increased consumption in winter')}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Carbon Credits */}
                {result.carbonCreditsValue > 0 && (
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <BadgeDollarSign className="h-5 w-5 text-green-500" />
                        <span className="font-medium">{t('scenarios.results.carbonCredits', 'Carbon Credits')}</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">-{fmtCurrency(result.carbonCreditsValue)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('scenarios.results.carbonCreditsDesc', 'Estimated revenue')}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Note */}
              <p className="text-xs text-muted-foreground italic">
                {t('scenarios.results.advancedNote', 'Note: These costs are calculated based on specified parameters. Actual values may vary depending on your specific contracts and local conditions.')}
              </p>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Settings2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('scenarios.results.noAdvancedCosts', 'No Advanced Costs')}</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {t('scenarios.results.noAdvancedCostsDesc', 'Advanced parameters (downtime, insurance, telematics, carbon credits, climate impact) were not specified for this scenario. They can be added when creating the scenario in the "Operational Costs", "Energy Parameters" and "Environmental Impact" sections.')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="emissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('scenarios.results.co2ByVehicleType', 'CO₂ Emissions by Vehicle Type')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={co2Data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${formatNumber(value)}t`}
                    >
                      {co2Data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t('scenarios.results.co2Avoided', 'CO₂ Avoided')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(result.co2Savings)} {t('common.tonnes', 'tonnes')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('scenarios.results.vsDieselOnly', 'vs. diesel-only scenario')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t('scenarios.results.totalEmissions', 'Total Emissions')}</p>
                <p className="text-2xl font-bold">{formatNumber(result.co2Total)} t</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('scenarios.results.overAnalysisPeriod', 'over analysis period')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t('scenarios.results.reduction', 'Reduction')}</p>
                <p className="text-2xl font-bold">{result.co2SavingsPercent.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('scenarios.results.emissionsReduction', 'emissions reduction')}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('scenarios.results.fleetComposition', 'Fleet Composition')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fleetData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {fleetData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Fuel className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">Diesel</span>
                </div>
                <p className="text-2xl font-bold">{dieselData.count}</p>
                <p className="text-sm text-muted-foreground">
                  CAPEX: {fmtCurrency(dieselData.capex)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{t('scenarios.results.electric', 'Electric')}</span>
                </div>
                <p className="text-2xl font-bold">{evData.count}</p>
                <p className="text-sm text-muted-foreground">
                  CAPEX: {fmtCurrency(evData.capex)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">{t('scenarios.results.hydrogen', 'Hydrogen')}</span>
                </div>
                <p className="text-2xl font-bold">{hydrogenData.count}</p>
                <p className="text-sm text-muted-foreground">
                  CAPEX: {fmtCurrency(hydrogenData.capex)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-4">
          {/* Alert if infrastructure not included */}
          {result.totalInfrastructureCost === 0 && (result.chargingStations > 0 || result.h2Stations > 0) && (
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">{t('scenarios.results.infraNotIncluded', 'Infrastructure not included in this TCO')}</p>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mb-3">
                    {t('scenarios.results.infraNotIncludedDesc', 'Infrastructure costs must be estimated and explicitly applied to this scenario.')}
                  </p>
                  {scenarioId ? (
                    <a 
                      href={`/dashboard/infrastructure?scenario=${scenarioId}&returnTo=${encodeURIComponent(`/dashboard/scenarios/${scenarioId}/results`)}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      <Building2 className="h-4 w-4" />
                      {t('scenarios.results.estimateAndApply', 'Estimate & apply infrastructure')}
                    </a>
                  ) : (
                    <a 
                      href="/dashboard/infrastructure"
                      className="inline-flex items-center gap-2 text-sm text-amber-700 hover:underline font-medium"
                    >
                      <Building2 className="h-4 w-4" />
                      {t('scenarios.results.openInfraCalculator', 'Open Infrastructure calculator')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  {t('scenarios.results.evChargingStations', 'EV Charging Stations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold mb-2">{result.chargingStations}</p>
                {result.chargingStationsCost > 0 ? (
                  <p className="text-muted-foreground">
                    {t('scenarios.results.estimatedCost', 'Estimated cost')}: {fmtCurrency(result.chargingStationsCost)}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    {t('scenarios.results.costToEstimate', 'Cost to estimate via Infrastructure module')}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  {t('scenarios.results.usageBasedEstimate', 'Estimate based on usage')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  {t('scenarios.results.h2RefuelingStations', 'H₂ Refueling Stations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold mb-2">{result.h2Stations}</p>
                {result.h2StationsCost > 0 ? (
                  <p className="text-muted-foreground">
                    {t('scenarios.results.estimatedCost', 'Estimated cost')}: {fmtCurrency(result.h2StationsCost)}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    {t('scenarios.results.costToEstimate', 'Cost to estimate via Infrastructure module')}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  {t('scenarios.results.usageBasedEstimate', 'Estimate based on usage')}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('scenarios.results.infraInvestment', 'Infrastructure Investment')}</p>
                  {result.totalInfrastructureCost > 0 ? (
                    <p className="text-3xl font-bold">{fmtCurrency(result.totalInfrastructureCost)}</p>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground italic">{t('scenarios.results.notEstimated', 'Not estimated')}</p>
                  )}
                </div>
                <div className="text-right">
                  {scenarioId ? (
                    <a 
                      href={`/dashboard/infrastructure?scenario=${scenarioId}&returnTo=${encodeURIComponent(`/dashboard/scenarios/${scenarioId}/results`)}`}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Building2 className="h-4 w-4" />
                      {result.totalInfrastructureCost > 0 ? t('scenarios.results.modifyEstimate', 'Modify estimate') : t('scenarios.results.estimateAndApply', 'Estimate & apply')}
                    </a>
                  ) : (
                    <a 
                      href="/dashboard/infrastructure" 
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Building2 className="h-4 w-4" />
                      {t('scenarios.results.estimateViaCalculator', 'Estimate via calculator')}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Buttons */}
      <div className="flex justify-end gap-3">
        <PDFDownloadButton 
          scenario={{
            id: scenarioId || 'unknown',
            name: scenarioName || t('scenarios.results.tcoAnalysis', 'TCO Analysis'),
            region: region,
            analysisYears: analysisYears,
            fleetComposition: {
              diesel: { count: dieselData.count },
              ev: { count: evData.count },
              hydrogen: { count: hydrogenData.count },
            }
          }}
          results={result} 
        />
        <Button variant="outline" onClick={onExportExcel}>
          <Download className="h-4 w-4 mr-2" />
          {t('export.excel', 'Export Excel')}
        </Button>
      </div>
    </div>
  );
}
