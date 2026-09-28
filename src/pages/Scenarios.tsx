import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ScenarioForm } from '@/components/scenarios/ScenarioForm';
import { TCOResults } from '@/components/scenarios/TCOResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Calculator,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Building2,
  GraduationCap,
} from 'lucide-react';
import { PDFDownloadButton } from '@/components/reports';
import { CreateScenarioForm, TCOResult, DEFAULT_REFERENCE_DATA, REGION_LABELS, Region, Scenario } from '@/lib/calculations/types';
import { calculateTCO, compareWithBaseline } from '@/lib/calculations/tco';
import { supabase } from '@/integrations/supabase/client';
import { fetchReferenceData } from '@/lib/supabase/referenceData';
import { saveTCOResult } from '@/lib/supabase/tcoResults';
import { useToast } from '@/hooks/use-toast';
import { VehicleLimitBadge } from '@/components/dashboard/VehicleLimitBadge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface ScenarioWithResult {
  id: string;
  name: string;
  region: string;
  fleetComposition: {
    diesel: { count: number; annualKm: number };
    ev: { count: number; annualKm: number };
    hydrogen: { count: number; annualKm: number };
  };
  createdAt: string;
  result?: TCOResult;
}

// Validation thresholds (Canadian industry benchmarks 2026)
const BENCHMARKS = {
  dieselTruckCost: { min: 120000, max: 220000, unit: 'CAD' },
  evTruckCost: { min: 250000, max: 500000, unit: 'CAD' },
  h2TruckCost: { min: 300000, max: 600000, unit: 'CAD' },
  dieselPrice: { min: 1.20, max: 2.20, unit: 'CAD/L' },
  electricityPrice: { min: 0.06, max: 0.20, unit: 'CAD/kWh' },
  hydrogenPrice: { min: 8.0, max: 18.0, unit: 'CAD/kg' },
  co2PerLiter: { min: 2.4, max: 2.8, unit: 'kg/L' },
};

interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

// Validation function that returns translation keys instead of hardcoded messages
function validateReferenceData(refData: typeof DEFAULT_REFERENCE_DATA, t: (key: string, options?: Record<string, unknown>) => string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (refData.diesel_truck < BENCHMARKS.dieselTruckCost.min || refData.diesel_truck > BENCHMARKS.dieselTruckCost.max) {
    warnings.push({
      field: 'diesel_truck',
      message: t('scenarios.validation.dieselTruckCostWarning', { 
        cost: formatCurrency(refData.diesel_truck), 
        min: formatCurrency(BENCHMARKS.dieselTruckCost.min), 
        max: formatCurrency(BENCHMARKS.dieselTruckCost.max) 
      }),
      severity: 'warning',
    });
  }

  if (refData.ev_truck < BENCHMARKS.evTruckCost.min || refData.ev_truck > BENCHMARKS.evTruckCost.max) {
    warnings.push({
      field: 'ev_truck',
      message: t('scenarios.validation.evTruckCostWarning', { cost: formatCurrency(refData.ev_truck) }),
      severity: 'warning',
    });
  }

  if (refData.diesel_price < BENCHMARKS.dieselPrice.min || refData.diesel_price > BENCHMARKS.dieselPrice.max) {
    warnings.push({
      field: 'diesel_price',
      message: t('scenarios.validation.dieselPriceWarning', { 
        price: refData.diesel_price.toFixed(2),
        min: BENCHMARKS.dieselPrice.min.toFixed(2),
        max: BENCHMARKS.dieselPrice.max.toFixed(2)
      }),
      severity: 'warning',
    });
  }

  return warnings;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatDateLocalized(dateString: string, language: string): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(dateString).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Scenarios() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('create');
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentResult, setCurrentResult] = useState<TCOResult | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioWithResult[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [referenceData, setReferenceData] = useState(DEFAULT_REFERENCE_DATA);
  const [selectedRegion, setSelectedRegion] = useState<Region>('Canada');
  
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);

  // Find current scenario from result and map to Scenario type for recommendations
  const currentScenario = scenarios.find(s => s.result?.scenarioName === currentResult?.scenarioName);
  const mappedScenario: Scenario | null = currentScenario ? {
    id: currentScenario.id,
    name: currentScenario.name,
    projectId: '',
    region: currentScenario.region as Region,
    fleetComposition: currentScenario.fleetComposition,
    analysisYears: 10,
    discountRate: 5,
    createdAt: currentScenario.createdAt,
  } : null;

  // Load scenarios from database
  useEffect(() => {
    loadScenarios();
  }, []);

  // Load reference data when region changes
  useEffect(() => {
    loadReferenceData(selectedRegion);
  }, [selectedRegion]);

  const loadScenarios = async () => {
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .select('*, tco_results(*)')
        .eq('tco_results.is_current', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const scenariosWithResults: ScenarioWithResult[] = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        region: s.region,
        fleetComposition: s.fleet_composition,
        createdAt: s.created_at,
        result: s.tco_results?.[0] ? {
          scenarioId: s.id,
          scenarioName: s.name,
          capex: s.tco_results[0].capex,
          opexTotal: s.tco_results[0].opex_total,
          tcoTotal: s.tco_results[0].tco_total,
          tcoPerKm: s.tco_results[0].tco_per_km || 0,
          npv: s.tco_results[0].npv || 0,
          residualValue: s.tco_results[0].residual_value || 0,
          paybackPeriodYears: s.tco_results[0].payback_period_years,
          co2Total: s.tco_results[0].co2_total,
          co2Savings: s.tco_results[0].co2_savings || 0,
          co2SavingsPercent: s.tco_results[0].co2_savings_percent || 0,
          chargingStations: s.tco_results[0].charging_stations || 0,
          chargingStationsCost: s.tco_results[0].charging_stations_cost || 0,
          h2Stations: s.tco_results[0].h2_stations || 0,
          h2StationsCost: s.tco_results[0].h2_stations_cost || 0,
          totalInfrastructureCost: s.tco_results[0].total_infrastructure_cost || 0,
          yearlyBreakdown: s.tco_results[0].yearly_breakdown || [],
          byVehicleType: s.tco_results[0].by_vehicle_type || {
            diesel: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
            ev: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
            hydrogen: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
          },
          // Map advanced costs from database
          downtimeCost: s.tco_results[0].downtime_cost || 0,
          insuranceCost: s.tco_results[0].insurance_cost || 0,
          telematicsCost: s.tco_results[0].telematics_cost || 0,
          gridDemandCost: s.tco_results[0].grid_demand_cost || 0,
          carbonCreditsValue: s.tco_results[0].carbon_credits_value || 0,
          coldWeatherImpact: s.tco_results[0].cold_weather_impact || 0,
        } : undefined,
      }));

      setScenarios(scenariosWithResults);
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

  const loadReferenceData = async (region: Region) => {
    try {
      const refData = await fetchReferenceData(region);
      setReferenceData(refData);
      
      // Validate reference data with translation function
      const warnings = validateReferenceData(refData, t);
      setValidationWarnings(warnings);
    } catch (error) {
      console.warn('Using default reference data:', error);
      setReferenceData(DEFAULT_REFERENCE_DATA);
    }
  };

  const handleFormSubmit = async (formData: CreateScenarioForm) => {
    setIsCalculating(true);
    setSelectedRegion(formData.region);

    try {
      // Get reference data for the selected region
      let refData = referenceData;
      try {
        refData = await fetchReferenceData(formData.region);
      } catch (e) {
        console.warn('Using default reference data');
      }

      // Create scenario in database (using a default project for now)
      const { data: projects } = await supabase.from('projects').select('id').limit(1);
      let projectId = projects?.[0]?.id;

      if (!projectId) {
        // Create a default project with user ownership
        if (!user) {
          throw new Error(t('scenarios.auth.loginRequired'));
        }
        
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert({
            name: t('scenarios.defaultProjectName'),
            description: t('scenarios.defaultProjectDescription'),
            country_or_region: formData.region,
            user_id: user.id,
          })
          .select('id')
          .single();

        if (projectError) throw projectError;
        projectId = newProject.id;
      }

      // Create scenario using raw insert - include vehicleConfiguration in fleet_composition for persistence
      const fleetCompositionWithConfig = {
        ...formData.fleetComposition,
        vehicleConfiguration: formData.vehicleConfiguration,
      };
      
      const { data: scenario, error: scenarioError } = await supabase
        .from('scenarios')
        .insert([{
          project_id: projectId,
          name: formData.name,
          region: formData.region,
          analysis_years: formData.analysisYears,
          discount_rate: formData.discountRate,
          fleet_composition: fleetCompositionWithConfig as any,
        }])
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // Calculate TCO - include vehicleConfiguration for multiplier overrides
      const tcoScenario = {
        id: scenario.id,
        projectId: scenario.project_id,
        name: scenario.name,
        region: scenario.region as Region,
        analysisYears: scenario.analysis_years,
        discountRate: scenario.discount_rate,
        fleetComposition: formData.fleetComposition,
        vehicleConfiguration: formData.vehicleConfiguration,
        createdAt: scenario.created_at,
      };

      const result = calculateTCO(tcoScenario, refData);

      // Save result to database
      await saveTCOResult(result);

      setCurrentResult(result);
      setActiveTab('results');
      loadScenarios();

      toast({
        title: t('scenarios.toast.calculationComplete'),
        description: t('scenarios.toast.calculationDesc', { tco: formatCurrency(result.tcoTotal), years: formData.analysisYears }),
      });
    } catch (error) {
      console.error('Error calculating TCO:', error);
      toast({
        title: t('scenarios.toast.error'),
        description: error instanceof Error ? error.message : t('scenarios.toast.calculationError'),
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    try {
      const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId);
      if (error) throw error;
      
      setScenarios(scenarios.filter(s => s.id !== scenarioId));
      toast({
        title: t('scenarios.toast.scenarioDeleted'),
        description: t('scenarios.toast.scenarioDeletedDesc'),
      });
    } catch (error) {
      console.error('Error deleting scenario:', error);
      toast({
        title: t('scenarios.toast.error'),
        description: t('scenarios.toast.deleteError'),
        variant: 'destructive',
      });
    }
  };


  const handleExportExcel = () => {
    if (!currentResult) {
      toast({
        title: t('export.pdfError'),
        description: t('export.noResult'),
        variant: 'destructive',
      });
      return;
    }

    setIsExportingCSV(true);

    try {
      const csvT = (key: string) => t(`export.csvContent.${key}`);
      
      // Build comprehensive CSV content
      const lines: string[] = [];
      
      // Section 1: Scenario Information
      lines.push(csvT('scenarioInfo'));
      lines.push(`${csvT('headers.metric')},${csvT('headers.value')},${csvT('headers.unit')}`);
      lines.push(`${csvT('scenarioName')},${currentResult.scenarioName},`);
      lines.push(`${csvT('region')},${REGION_LABELS[selectedRegion]},`);
      lines.push(`${csvT('exportDate')},${new Date().toISOString().split('T')[0]},`);
      lines.push('');
      
      // Section 2: Energy Prices
      lines.push(csvT('energyPrices'));
      lines.push(`${csvT('headers.metric')},${csvT('headers.value')},${csvT('headers.unit')}`);
      lines.push(`${csvT('dieselPrice')},${referenceData.diesel_price.toFixed(2)},USD/gal`);
      lines.push(`${csvT('electricityPrice')},${referenceData.electricity_price.toFixed(3)},USD/kWh`);
      lines.push(`${csvT('hydrogenPrice')},${referenceData.hydrogen_price.toFixed(2)},USD/kg`);
      lines.push('');
      
      // Section 3: TCO Summary
      lines.push(csvT('tcoSummary'));
      lines.push(`${csvT('headers.metric')},${csvT('headers.value')},${csvT('headers.unit')}`);
      lines.push(`${csvT('capex')},${currentResult.capex.toFixed(2)},USD`);
      lines.push(`${csvT('opexTotal')},${currentResult.opexTotal.toFixed(2)},USD`);
      lines.push(`${csvT('tcoTotal')},${currentResult.tcoTotal.toFixed(2)},USD`);
      lines.push(`${csvT('tcoPerKm')},${currentResult.tcoPerKm.toFixed(4)},USD/km`);
      lines.push(`${csvT('npv')},${currentResult.npv.toFixed(2)},USD`);
      lines.push(`${csvT('residualValue')},${currentResult.residualValue.toFixed(2)},USD`);
      lines.push(`${csvT('paybackPeriod')},${currentResult.paybackPeriodYears?.toFixed(1) || 'N/A'},${t('export.report.units.years')}`);
      lines.push(`${csvT('co2Total')},${currentResult.co2Total.toFixed(0)},${t('export.report.units.tons')}`);
      lines.push(`${csvT('co2Reduction')},${currentResult.co2SavingsPercent.toFixed(1)},%`);
      lines.push(`${csvT('evChargers')},${currentResult.chargingStations},${t('export.report.headers.count')}`);
      lines.push(`${csvT('h2Stations')},${currentResult.h2Stations},${t('export.report.headers.count')}`);
      lines.push(`${csvT('infraCost')},${currentResult.totalInfrastructureCost.toFixed(2)},USD`);
      lines.push('');
      
      // Section 4: Yearly Breakdown
      lines.push(csvT('yearlyBreakdown'));
      lines.push(`${t('export.report.headers.year')},${t('export.report.headers.capex')},${t('export.report.headers.opex')},${t('export.report.headers.total')},${t('export.report.headers.cumulative')}`);
      currentResult.yearlyBreakdown.forEach(y => {
        lines.push(`${y.year},${y.capex.toFixed(2)},${y.opex.toFixed(2)},${y.totalCost.toFixed(2)},${y.cumulativeCost.toFixed(2)}`);
      });
      lines.push('');
      
      // Section 5: Fleet Breakdown by Type
      lines.push(csvT('fleetBreakdown'));
      lines.push(`${t('export.report.headers.type')},${t('export.report.headers.count')},${t('export.report.headers.capex')},${t('export.report.headers.opex')},${csvT('fuelCost')},${csvT('maintenanceCost')},${csvT('insuranceCost')},${t('export.report.headers.co2')}`);
      
      const vehicleTypes = [
        { key: 'diesel', data: currentResult.byVehicleType.diesel },
        { key: 'electric', data: currentResult.byVehicleType.ev },
        { key: 'hydrogen', data: currentResult.byVehicleType.hydrogen },
      ];
      
      vehicleTypes.forEach(({ key, data }) => {
        lines.push(`${t(`export.report.vehicleTypes.${key}`)},${data.count},${data.capex.toFixed(2)},${data.opex.toFixed(2)},${data.fuelCost.toFixed(2)},${data.maintenanceCost.toFixed(2)},${data.insuranceCost.toFixed(2)},${data.co2.toFixed(0)}`);
      });

      const csvContent = lines.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' }); // BOM for Excel compatibility
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `H2Fleet-TCO-${currentResult.scenarioName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: t('export.csvSuccess'),
        description: t('export.csvSuccessDesc'),
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: t('export.pdfError'),
        description: 'Unable to generate CSV',
        variant: 'destructive',
      });
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Comparison chart data
  const comparisonData = scenarios
    .filter(s => s.result)
    .slice(0, 5)
    .map(s => ({
      name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
      tco: s.result!.tcoTotal,
      capex: s.result!.capex,
      opex: s.result!.opexTotal,
      co2: s.result!.co2Total,
    }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{t('scenarios.page.title')}</h1>
              <VehicleLimitBadge />
            </div>
            <p className="text-muted-foreground">
              {t('scenarios.page.subtitle')}
            </p>
          </div>
          <div className="flex gap-3">
            {currentResult && mappedScenario && (
              <PDFDownloadButton
                scenario={{
                  id: mappedScenario.id,
                  name: mappedScenario.name,
                  region: mappedScenario.region,
                  analysisYears: mappedScenario.analysisYears,
                  discountRate: mappedScenario.discountRate,
                  fleetComposition: {
                    diesel: { count: mappedScenario.fleetComposition.diesel.count, annualKm: mappedScenario.fleetComposition.diesel.annualKm },
                    ev: { count: mappedScenario.fleetComposition.ev.count, annualKm: mappedScenario.fleetComposition.ev.annualKm },
                    hydrogen: { count: mappedScenario.fleetComposition.hydrogen.count, annualKm: mappedScenario.fleetComposition.hydrogen.annualKm },
                  } as Record<string, { count: number; annualKm?: number }>,
                }}
                results={currentResult}
                variant="outline"
              />
            )}
            <Button variant="outline" onClick={handleExportExcel} disabled={!currentResult || isExportingCSV}>
              {isExportingCSV ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {t('export.csv')}
            </Button>
            <Button onClick={() => setActiveTab('create')}>
              <Plus className="w-4 h-4 mr-2" />
              {t('export.newScenario')}
            </Button>
          </div>
        </div>

        {/* Validation Warnings */}
        {validationWarnings.length > 0 && (
          <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    {t('scenarios.validation.title')}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                    {validationWarnings.map((w, i) => (
                      <li key={i}>• {w.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create">{t('scenarios.tabs.create')}</TabsTrigger>
            <TabsTrigger value="results" disabled={!currentResult}>{t('scenarios.tabs.results')}</TabsTrigger>
            <TabsTrigger value="compare">{t('scenarios.tabs.compare')}</TabsTrigger>
            <TabsTrigger value="history">{t('scenarios.tabs.history')}</TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="create" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <ScenarioForm
                  onSubmit={handleFormSubmit}
                  isLoading={isCalculating}
                />
              </div>
              <div className="flex items-center justify-center h-full">
                <Link 
                  to="/dashboard/help" 
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <GraduationCap className="w-5 h-5" />
                  {t('scenarios.seeHelpTraining', 'Need help? View methodology and reference data →')}
                </Link>
              </div>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-6">
            {currentResult ? (
              <TCOResults
                result={currentResult}
                scenario={mappedScenario}
                region={selectedRegion}
                maxBudget={maxBudget}
                onBudgetChange={setMaxBudget}
                onExportExcel={handleExportExcel}
              />
            ) : (
              <Card className="py-16">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Calculator className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('scenarios.noResults.title', 'No Results')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('scenarios.noResults.description', 'Create a scenario to see TCO results')}
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    {t('scenarios.noResults.cta', 'Create a scenario')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Compare Tab */}
          <TabsContent value="compare" className="mt-6">
            {comparisonData.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Comparaison TCO</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(v) => formatCurrency(v)} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="capex" name="CAPEX" fill="#8b5cf6" />
                          <Bar dataKey="opex" name="OPEX" fill="#ec4899" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Émissions CO₂</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(v: number) => `${v.toFixed(0)} t`} />
                          <Bar dataKey="co2" name="CO₂ (tonnes)" fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Tableau comparatif</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Scénario</TableHead>
                          <TableHead className="text-right">TCO Total</TableHead>
                          <TableHead className="text-right">CAPEX</TableHead>
                          <TableHead className="text-right">OPEX/an</TableHead>
                          <TableHead className="text-right">CO₂</TableHead>
                          <TableHead className="text-right">TCO/km</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scenarios.filter(s => s.result).slice(0, 10).map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(s.result!.tcoTotal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(s.result!.capex)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(s.result!.opexTotal / 10)}</TableCell>
                            <TableCell className="text-right">{s.result!.co2Total.toFixed(0)} t</TableCell>
                            <TableCell className="text-right">${s.result!.tcoPerKm.toFixed(3)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="py-16">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <TrendingUp className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun scénario à comparer</h3>
                  <p className="text-muted-foreground mb-4">
                    Créez au moins 2 scénarios pour les comparer
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Scénarios récents</CardTitle>
              </CardHeader>
              <CardContent>
                {scenarios.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Région</TableHead>
                        <TableHead>Flotte</TableHead>
                        <TableHead>Infrastructure</TableHead>
                        <TableHead className="text-right">TCO</TableHead>
                        <TableHead className="text-right">CO₂</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scenarios.map((s) => {
                        const totalVehicles = 
                          s.fleetComposition.diesel.count + 
                          s.fleetComposition.ev.count + 
                          s.fleetComposition.hydrogen.count;
                        
                        // Check if infrastructure is linked
                        const hasInfrastructure = !!(s.fleetComposition as any)?.infrastructure?.totalCapex;

                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {REGION_LABELS[s.region as Region] || s.region}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {totalVehicles} véhicules
                              <span className="text-xs text-muted-foreground ml-1">
                                ({s.fleetComposition.diesel.count}D / {s.fleetComposition.ev.count}EV / {s.fleetComposition.hydrogen.count}H₂)
                              </span>
                            </TableCell>
                            <TableCell>
                              {hasInfrastructure ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  Liée
                                </Badge>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-xs"
                                  onClick={() => navigate(`/dashboard/infrastructure?scenario=${s.id}`)}
                                >
                                  <Building2 className="h-3 w-3 mr-1" />
                                  Ajouter
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {s.result ? formatCurrency(s.result.tcoTotal) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {s.result ? `${s.result.co2Total.toFixed(0)} t` : '-'}
                            </TableCell>
                            <TableCell>{formatDateLocalized(s.createdAt, i18n.language)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (s.result) {
                                      setCurrentResult(s.result);
                                      setActiveTab('results');
                                    }
                                  }}
                                  disabled={!s.result}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteScenario(s.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Aucun scénario enregistré
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
