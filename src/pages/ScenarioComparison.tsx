import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ArrowLeft, BarChart3, Info, CheckCircle2 } from 'lucide-react';
import { ComparisonPDFDownloadButton } from '@/components/reports/ComparisonPDFDownloadButton';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/currency';

interface ScenarioWithResult {
  id: string;
  name: string;
  region: string;
  created_at: string;
  tco_result?: {
    tco_total: number;
    tco_per_km: number;
    capex: number;
    opex_total: number;
    co2_total: number;
    co2_savings_percent: number;
    npv: number;
    payback_period_years: number | null;
  };
}

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ScenarioComparison() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Fetch scenarios with their TCO results
  const { data: scenarios, isLoading } = useQuery({
    queryKey: ['scenarios-with-results', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: scenariosData, error: scenariosError } = await supabase
        .from('scenarios')
        .select('id, name, region, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (scenariosError) throw scenariosError;

      // Fetch TCO results for each scenario
      const scenariosWithResults: ScenarioWithResult[] = await Promise.all(
        (scenariosData || []).map(async (scenario) => {
          const { data: tcoResult } = await supabase
            .from('tco_results')
            .select('tco_total, tco_per_km, capex, opex_total, co2_total, co2_savings, co2_savings_percent, npv, payback_period_years')
            .eq('scenario_id', scenario.id)
            .eq('is_current', true)
            .maybeSingle();

          return {
            ...scenario,
            tco_result: tcoResult || undefined,
          };
        })
      );

      return scenariosWithResults;
    },
    enabled: !!projectId,
  });

  const handleToggleScenario = (scenarioId: string) => {
    setSelectedScenarios((prev) => {
      if (prev.includes(scenarioId)) {
        return prev.filter((id) => id !== scenarioId);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 scenarios
      }
      return [...prev, scenarioId];
    });
  };

  const handleCompare = () => {
    if (selectedScenarios.length >= 2) {
      setShowComparison(true);
    }
  };

  const selectedScenarioData = scenarios?.filter((s) => selectedScenarios.includes(s.id)) || [];

  // Prepare chart data
  const tcoComparisonData = selectedScenarioData.map((s) => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
    fullName: s.name,
    tcoTotal: s.tco_result?.tco_total || 0,
    capex: s.tco_result?.capex || 0,
    opex: s.tco_result?.opex_total || 0,
  }));

  const co2ComparisonData = selectedScenarioData.map((s, i) => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
    fullName: s.name,
    co2: s.tco_result?.co2_total || 0,
    savings: s.tco_result?.co2_savings_percent || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back', 'Retour')}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('comparison.title', 'Comparaison de scénarios')}
            </h1>
            <p className="text-muted-foreground">
              {t('comparison.subtitle', 'Sélectionnez 2 à 5 scénarios pour les comparer côte à côte.')}
            </p>
          </div>
          {showComparison && (
            <ComparisonPDFDownloadButton 
              scenarios={selectedScenarioData}
              projectName={`Project-${projectId}`}
            />
          )}
        </div>

        {!showComparison ? (
          /* Selection View */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {t('comparison.selectScenarios', 'Sélectionner les scénarios')}
              </CardTitle>
              <CardDescription>
                {t('comparison.selectDescription', 'Cochez les scénarios que vous souhaitez comparer (2-5 maximum)')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scenarios && scenarios.length > 0 ? (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>{t('comparison.scenarioName', 'Scénario')}</TableHead>
                        <TableHead>{t('comparison.region', 'Région')}</TableHead>
                        <TableHead className="text-right">{t('comparison.tcoTotal', 'TCO Total')}</TableHead>
                        <TableHead className="text-right">{t('comparison.co2', 'CO₂ (tonnes)')}</TableHead>
                        <TableHead>{t('comparison.status', 'Statut')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scenarios.map((scenario) => (
                        <TableRow key={scenario.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <Checkbox
                              checked={selectedScenarios.includes(scenario.id)}
                              onCheckedChange={() => handleToggleScenario(scenario.id)}
                              disabled={!selectedScenarios.includes(scenario.id) && selectedScenarios.length >= 5}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{scenario.name}</TableCell>
                          <TableCell>{scenario.region}</TableCell>
                          <TableCell className="text-right">
                            {scenario.tco_result
                              ? formatCurrency(scenario.tco_result.tco_total, 'Canada')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {scenario.tco_result
                              ? scenario.tco_result.co2_total.toLocaleString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {scenario.tco_result ? (
                              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t('comparison.calculated', 'Calculé')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {t('comparison.pending', 'En attente')}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedScenarios.length} {t('comparison.selected', 'sélectionné(s)')}
                    </p>
                    <Button
                      onClick={handleCompare}
                      disabled={selectedScenarios.length < 2}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      {t('comparison.compare', 'Comparer')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {t('comparison.noScenarios', 'Aucun scénario disponible. Créez d\'abord des scénarios pour ce projet.')}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Comparison View */
          <div className="space-y-6">
            {/* Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle>{t('comparison.summaryTable', 'Tableau comparatif')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('comparison.metric', 'Métrique')}</TableHead>
                      {selectedScenarioData.map((s) => (
                        <TableHead key={s.id} className="text-right">
                          {s.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.tcoTotal', 'TCO Total')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right font-semibold">
                          {s.tco_result ? formatCurrency(s.tco_result.tco_total, 'Canada') : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.capex', 'CAPEX')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.tco_result ? formatCurrency(s.tco_result.capex, 'Canada') : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.opex', 'OPEX Total')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.tco_result ? formatCurrency(s.tco_result.opex_total, 'Canada') : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.tcoPerKm', 'TCO/km')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.tco_result ? `$${s.tco_result.tco_per_km.toFixed(2)}` : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.npv', 'VAN')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.tco_result ? formatCurrency(s.tco_result.npv, 'Canada') : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.payback', 'Payback (années)')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.tco_result?.payback_period_years
                            ? s.tco_result.payback_period_years.toFixed(1)
                            : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.co2Total', 'CO₂ (tonnes)')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.tco_result ? s.tco_result.co2_total.toLocaleString() : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{t('comparison.co2Savings', 'Réduction CO₂')}</TableCell>
                      {selectedScenarioData.map((s) => (
                        <TableCell key={s.id} className="text-right">
                          {s.tco_result ? `${s.tco_result.co2_savings_percent.toFixed(1)}%` : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* TCO Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t('comparison.tcoComparison', 'Comparaison TCO')}</CardTitle>
                <CardDescription>
                  {t('comparison.capexOpexBreakdown', 'Répartition CAPEX / OPEX par scénario')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tcoComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                      <YAxis type="category" dataKey="name" width={120} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, 'Canada')}
                        labelFormatter={(label) => tcoComparisonData.find((d) => d.name === label)?.fullName || label}
                      />
                      <Legend />
                      <Bar dataKey="capex" name="CAPEX" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="opex" name="OPEX" stackId="a" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* CO2 Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>{t('comparison.co2Comparison', 'Comparaison CO₂')}</CardTitle>
                <CardDescription>
                  {t('comparison.emissionsPerScenario', 'Émissions totales par scénario')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={co2ComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${v.toLocaleString()}`} />
                      <Tooltip
                        formatter={(value: number) => `${value.toLocaleString()} tonnes`}
                        labelFormatter={(label) => co2ComparisonData.find((d) => d.name === label)?.fullName || label}
                      />
                      <Bar dataKey="co2" name="CO₂ (tonnes)">
                        {co2ComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Back to selection */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setShowComparison(false)}>
                {t('comparison.modifySelection', 'Modifier la sélection')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
