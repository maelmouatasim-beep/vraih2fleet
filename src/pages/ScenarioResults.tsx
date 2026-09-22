import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { TCOResults } from '@/components/scenarios/TCOResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Trash2, Building2, Loader2, X } from 'lucide-react';
import { ShareProjectButton } from '@/components/collaboration/ShareProjectButton';
import { getScenario, deleteScenario, updateScenario } from '@/lib/supabase/scenarios';
import { getLatestTCOResult, saveTCOResult } from '@/lib/supabase/tcoResults';
import { fetchReferenceData } from '@/lib/supabase/referenceData';
import { generateInfrastructureFromScenario, getInfrastructurePlanForScenario } from '@/lib/supabase/infrastructure';
import { calculateTCO } from '@/lib/calculations/tco';
import { Scenario, TCOResult, DEFAULT_REFERENCE_DATA, REGION_LABELS, FleetComposition } from '@/lib/calculations/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function ScenarioResults() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [result, setResult] = useState<TCOResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [hasInfrastructurePlan, setHasInfrastructurePlan] = useState(false);
  const [isGeneratingInfra, setIsGeneratingInfra] = useState(false);
  const [isRemovingInfra, setIsRemovingInfra] = useState(false);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);

  useEffect(() => {
    if (scenarioId) {
      loadData();
    }
  }, [scenarioId]);

  const loadData = async () => {
    if (!scenarioId) return;
    
    setIsLoading(true);
    try {
      const [scenarioData, resultData, infraPlan] = await Promise.all([
        getScenario(scenarioId),
        getLatestTCOResult(scenarioId),
        getInfrastructurePlanForScenario(scenarioId),
      ]);
      
      setScenario(scenarioData);
      setResult(resultData);
      setHasInfrastructurePlan(!!infraPlan);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scenario data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!scenario) return;
    
    setIsRecalculating(true);
    try {
      let refData = DEFAULT_REFERENCE_DATA;
      try {
        refData = await fetchReferenceData(scenario.region);
      } catch (e) {
        console.warn('Using default reference data:', e);
      }

      const tcoResult = calculateTCO(scenario, refData);
      await saveTCOResult(tcoResult);
      setResult(tcoResult);
      
      toast({
        title: 'Recalculation Complete',
        description: 'TCO results updated with latest reference data',
      });
    } catch (error) {
      console.error('Error recalculating:', error);
      toast({
        title: 'Error',
        description: 'Failed to recalculate TCO',
        variant: 'destructive',
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleDelete = async () => {
    if (!scenario) return;
    
    try {
      await deleteScenario(scenario.id);
      toast({
        title: 'Scenario Deleted',
        description: 'The scenario has been removed',
      });
      navigate(`/dashboard/projects/${scenario.projectId}`);
    } catch (error) {
      console.error('Error deleting scenario:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete scenario',
        variant: 'destructive',
      });
    }
  };

  const handleViewInfrastructure = async () => {
    if (!scenarioId || !user?.id) return;
    
    setIsGeneratingInfra(true);
    try {
      // Check if plan already exists
      const existingPlan = await getInfrastructurePlanForScenario(scenarioId);
      
      if (!existingPlan) {
        // Generate new infrastructure plan
        await generateInfrastructureFromScenario(scenarioId, user.id);
        toast({
          title: t('scenarioResults.infrastructureGenerated', 'Infrastructure Plan Generated'),
          description: t('scenarioResults.infrastructureGeneratedDesc', 'Infrastructure requirements calculated from scenario'),
        });
      }
      
      // Build URL with returnTo for bidirectional navigation
      const returnTo = encodeURIComponent(`/dashboard/scenarios/${scenarioId}/results`);
      navigate(`/dashboard/infrastructure?scenario=${scenarioId}&returnTo=${returnTo}`);
    } catch (error) {
      console.error('Error generating infrastructure:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate infrastructure plan',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingInfra(false);
    }
  };
  
  // Check if infrastructure has been applied to this scenario
  const hasAppliedInfrastructure = scenario?.fleetComposition && 
    typeof scenario.fleetComposition === 'object' &&
    'infrastructure' in (scenario.fleetComposition as object);

  // Handler to remove infrastructure from scenario
  const handleRemoveInfrastructure = async () => {
    if (!scenario || !scenarioId) return;
    
    setIsRemovingInfra(true);
    try {
      // Remove infrastructure block from fleet_composition
      const currentFleet = scenario.fleetComposition as FleetComposition & { infrastructure?: unknown };
      const { infrastructure: _, ...fleetWithoutInfra } = currentFleet;
      
      // Update scenario
      const updatedScenario = await updateScenario(scenarioId, {
        fleetComposition: fleetWithoutInfra as FleetComposition,
      });
      
      setScenario(updatedScenario);
      
      // Recalculate TCO without infrastructure costs
      let refData = DEFAULT_REFERENCE_DATA;
      try {
        refData = await fetchReferenceData(updatedScenario.region);
      } catch (e) {
        console.warn('Using default reference data:', e);
      }
      
      const tcoResult = calculateTCO(updatedScenario, refData);
      await saveTCOResult(tcoResult);
      setResult(tcoResult);
      
      toast({
        title: t('scenarioResults.infrastructureRemoved', 'Infrastructure retirée'),
        description: t('scenarioResults.infrastructureRemovedDesc', 'Les coûts d\'infrastructure ont été retirés du scénario'),
      });
    } catch (error) {
      console.error('Error removing infrastructure:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove infrastructure',
        variant: 'destructive',
      });
    } finally {
      setIsRemovingInfra(false);
    }
  };

  const handleExportPDF = () => {
    toast({
      title: 'Export PDF',
      description: 'PDF export will be available soon',
    });
  };

  const handleExportExcel = () => {
    if (!result) return;
    
    const headers = ['Metric', 'Value'];
    const rows = [
      ['CAPEX', result.capex.toString()],
      ['OPEX Total', result.opexTotal.toString()],
      ['TCO Total', result.tcoTotal.toString()],
      ['TCO per km', result.tcoPerKm.toString()],
      ['NPV', result.npv.toString()],
      ['CO2 Total (tonnes)', result.co2Total.toString()],
      ['CO2 Savings (%)', result.co2SavingsPercent.toString()],
      ['Charging Stations', result.chargingStations.toString()],
      ['H2 Stations', result.h2Stations.toString()],
      ['Infrastructure Cost', result.totalInfrastructureCost.toString()],
    ];
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tco-results-${scenario?.name || scenarioId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Export Complete',
      description: 'CSV file downloaded',
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!scenario) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <p className="text-muted-foreground">Scenario not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{scenario.name}</h1>
              <p className="text-muted-foreground">
                {REGION_LABELS[scenario.region]} • {scenario.analysisYears} years • {scenario.discountRate}% discount rate
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {scenario.projectId && (
              <ShareProjectButton projectId={scenario.projectId} variant="outline" size="default" />
            )}
            <Button
              variant={hasAppliedInfrastructure ? "default" : "outline"}
              onClick={handleViewInfrastructure}
              disabled={isGeneratingInfra}
            >
              {isGeneratingInfra ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-2" />
              )}
              {hasAppliedInfrastructure 
                ? t('scenarioResults.infrastructureApplied', 'Infrastructure appliquée')
                : t('scenarioResults.estimateInfrastructure', 'Estimer & appliquer infrastructure')
              }
              {hasAppliedInfrastructure && (
                <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700">
                  ✓
                </Badge>
              )}
            </Button>
            {hasAppliedInfrastructure && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={isRemovingInfra}
                  >
                    {isRemovingInfra ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('scenarioResults.removeInfraDialog.title', 'Retirer l\'infrastructure ?')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('scenarioResults.removeInfraDialog.description', 
                        'Les coûts d\'infrastructure seront retirés de ce scénario. Le TCO sera recalculé sans ces coûts.'
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel', 'Annuler')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveInfrastructure}>
                      {t('scenarioResults.removeInfraDialog.confirm', 'Retirer')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              onClick={handleRecalculate}
              disabled={isRecalculating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
              {t('scenarioResults.recalculate')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('scenarioResults.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('scenarioResults.deleteDialog.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('scenarioResults.deleteDialog.description', { name: scenario.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Scenario Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Fleet Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Diesel</p>
                <p className="text-xl font-bold">{scenario.fleetComposition?.diesel?.count ?? 0} vehicles</p>
                <p className="text-sm text-muted-foreground">
                  {(scenario.fleetComposition?.diesel?.annualKm ?? 0).toLocaleString()} km/year
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Electric</p>
                <p className="text-xl font-bold">{scenario.fleetComposition?.ev?.count ?? 0} vehicles</p>
                <p className="text-sm text-muted-foreground">
                  {(scenario.fleetComposition?.ev?.annualKm ?? 0).toLocaleString()} km/year
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Hydrogen</p>
                <p className="text-xl font-bold">{scenario.fleetComposition?.hydrogen?.count ?? 0} vehicles</p>
                <p className="text-sm text-muted-foreground">
                  {(scenario.fleetComposition?.hydrogen?.annualKm ?? 0).toLocaleString()} km/year
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result ? (
          <TCOResults
            result={result}
            scenario={scenario}
            region={scenario.region}
            scenarioId={scenarioId}
            scenarioName={scenario.name}
            analysisYears={scenario.analysisYears}
            discountRate={scenario.discountRate}
            maxBudget={maxBudget}
            onBudgetChange={setMaxBudget}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
              <p className="text-muted-foreground">No calculation results yet</p>
              <Button onClick={handleRecalculate} disabled={isRecalculating}>
                {isRecalculating ? 'Calculating...' : 'Calculate TCO'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
