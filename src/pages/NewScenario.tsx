import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ScenarioForm } from '@/components/scenarios/ScenarioForm';
import { TCOResults } from '@/components/scenarios/TCOResults';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calculator } from 'lucide-react';
import { CreateScenarioForm, TCOResult, DEFAULT_REFERENCE_DATA } from '@/lib/calculations/types';
import { calculateTCO } from '@/lib/calculations/tco';
import { createScenario } from '@/lib/supabase/scenarios';
import { saveTCOResult } from '@/lib/supabase/tcoResults';
import { fetchReferenceData } from '@/lib/supabase/referenceData';
import { useToast } from '@/hooks/use-toast';

export default function NewScenario() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<TCOResult | null>(null);
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(null);

  const handleSubmit = async (data: CreateScenarioForm) => {
    if (!projectId) {
      toast({
        title: 'Error',
        description: 'Project ID is required',
        variant: 'destructive',
      });
      return;
    }

    setIsCalculating(true);
    
    try {
      // Create scenario in database
      const scenario = await createScenario(projectId, data);
      setSavedScenarioId(scenario.id);

      // Fetch reference data for region
      let refData = DEFAULT_REFERENCE_DATA;
      try {
        refData = await fetchReferenceData(data.region);
      } catch (e) {
        console.warn('Using default reference data:', e);
      }

      // Calculate TCO client-side - include vehicleConfiguration for multipliers
      const scenarioWithConfig = {
        ...scenario,
        vehicleConfiguration: data.vehicleConfiguration,
      };
      const tcoResult = calculateTCO(scenarioWithConfig, refData);
      
      // Save results to database
      await saveTCOResult(tcoResult);
      
      setResult(tcoResult);
      
      toast({
        title: 'Calculation Complete',
        description: `TCO calculated: ${formatCurrency(tcoResult.tcoTotal)}`,
      });
    } catch (error) {
      console.error('Error calculating TCO:', error);
      toast({
        title: 'Calculation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
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
    
    // Create CSV content
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
    a.download = `tco-results-${result.scenarioId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Export Complete',
      description: 'CSV file downloaded',
    });
  };

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
              <h1 className="text-2xl font-bold">New TCO Scenario</h1>
              <p className="text-muted-foreground">
                Configure fleet composition and calculate Total Cost of Ownership
              </p>
            </div>
          </div>
          {savedScenarioId && (
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/scenarios/${savedScenarioId}`)}
            >
              View Full Results
            </Button>
          )}
        </div>

        {/* Form or Results */}
        {!result ? (
          <ScenarioForm
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
            isLoading={isCalculating}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
              <Calculator className="h-5 w-5 text-primary" />
              <span className="text-primary font-medium">
                Calculation complete! Review your TCO results below.
              </span>
            </div>
            
            <TCOResults
              result={result}
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
            />
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setSavedScenarioId(null);
                }}
              >
                Create Another Scenario
              </Button>
              <Button onClick={() => navigate(`/dashboard/projects/${projectId}`)}>
                Back to Project
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value.toFixed(0)}`;
}
