import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { FlexibleScenarioForm } from '@/components/scenarios/FlexibleScenarioForm';
import { TCOResults } from '@/components/scenarios/TCOResults';
import { CreateFlexibleScenarioForm } from '@/lib/calculations/flexibleTypes';
import { calculateFlexibleTCO, convertVehiclesToFleetComposition } from '@/lib/calculations/flexibleTCO';
import { TCOResult, Region } from '@/lib/calculations/types';
import { supabase } from '@/integrations/supabase/client';
import { saveTCOResult } from '@/lib/supabase/tcoResults';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';

export default function NewFlexibleScenario() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TCOResult | null>(null);
  const [scenarioData, setScenarioData] = useState<CreateFlexibleScenarioForm | null>(null);

  const handleSubmit = async (data: CreateFlexibleScenarioForm) => {
    if (!projectId) {
      toast({
        title: t('common.error', 'Erreur'),
        description: t('flexibleScenario.noProject', 'Aucun projet sélectionné'),
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: t('common.error', 'Erreur'),
        description: t('auth.loginRequired', 'Vous devez être connecté'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Convert flexible vehicles to fleet composition
      const fleetComposition = convertVehiclesToFleetComposition(
        data.vehicles,
        data.advancedCosts
      );

      // Create scenario in database
      const { data: scenario, error: scenarioError } = await supabase
        .from('scenarios')
        .insert([{
          project_id: projectId,
          name: data.name,
          description: data.description,
          region: data.region,
          analysis_years: data.financialParams.analysisHorizonYears,
          discount_rate: data.financialParams.discountRate,
          fleet_composition: fleetComposition as any,
        }])
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // Calculate TCO
      const tcoResult = calculateFlexibleTCO(data, scenario.id);

      // Save result to database
      await saveTCOResult(tcoResult);

      setResult(tcoResult);
      setScenarioData(data);

      toast({
        title: t('flexibleScenario.success.title', 'Calcul TCO terminé'),
        description: t('flexibleScenario.success.description', 'Les résultats sont affichés ci-dessous'),
      });
      
    } catch (error) {
      console.error('Error creating scenario:', error);
      toast({
        title: t('common.error', 'Erreur'),
        description: error instanceof Error ? error.message : t('flexibleScenario.error.create', 'Impossible de créer le scénario'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (projectId) {
      navigate(`/dashboard/projects/${projectId}`);
    } else {
      navigate('/dashboard/projects');
    }
  };

  const handleReset = () => {
    setResult(null);
    setScenarioData(null);
  };

  // If we have results, show them
  if (result && scenarioData) {
    return (
      <DashboardLayout>
        <div className="py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('flexibleScenario.resultsTitle', 'Résultats TCO')}
              </h1>
              <p className="text-muted-foreground">
                {scenarioData.name}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('flexibleScenario.newCalculation', 'Nouveau calcul')}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.backToProject', 'Retour au projet')}
              </Button>
            </div>
          </div>
          
          <TCOResults 
            result={result} 
            region={scenarioData.region as Region}
            scenarioId={result.scenarioId}
            scenarioName={scenarioData.name}
            analysisYears={scenarioData.financialParams.analysisHorizonYears}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {t('flexibleScenario.pageTitle', 'Nouveau scénario TCO')}
          </h1>
          <p className="text-muted-foreground">
            {t('flexibleScenario.pageSubtitle', 'Définissez librement la composition de votre flotte pour calculer le coût total de possession.')}
          </p>
        </div>
        
        <FlexibleScenarioForm
          projectId={projectId || ''}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      </div>
    </DashboardLayout>
  );
}
