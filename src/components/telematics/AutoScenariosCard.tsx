import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Zap, Fuel, Leaf, Loader2, ArrowRight, TrendingUp, Pencil, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { VehicleGroup, ScenarioRecommendation, MockVehicle } from '@/lib/mockTelematicsData';
import { createScenariosFromTelematics } from '@/lib/supabase/autoScenarios';

interface AutoScenariosCardProps {
  groups: VehicleGroup[];
  recommendations: ScenarioRecommendation[];
  totalVehicles: number;
  vehicles: MockVehicle[];
}

export default function AutoScenariosCard({ 
  groups, 
  recommendations,
  totalVehicles,
  vehicles
}: AutoScenariosCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate summary stats
  const shortRange = groups.find(g => g.id === 'short-range');
  const mediumRange = groups.find(g => g.id === 'medium-range');
  const longRange = groups.find(g => g.id === 'long-range');

  const balancedRec = recommendations.find(r => r.type === 'Balanced');
  const potentialSavings = balancedRec?.tcoSavings || 0;
  const potentialCo2Reduction = balancedRec?.co2Reduction || 0;

  // Calculate telematics summary for prefill
  const totalAnnualKm = vehicles.reduce((sum, v) => sum + v.annualKm, 0);
  const avgAnnualKm = vehicles.length > 0 ? Math.round(totalAnnualKm / vehicles.length) : 0;
  const avgFuelConsumption = vehicles.length > 0 
    ? vehicles.reduce((sum, v) => sum + v.fuelConsumption, 0) / vehicles.length 
    : 0;

  const handleCreateCustomScenario = () => {
    // Store telematics data in sessionStorage for the form to pick up
    const telematicsData = {
      vehicleCount: totalVehicles,
      annualKm: avgAnnualKm,
      fuelConsumption: Math.round(avgFuelConsumption * 10) / 10,
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        count: g.vehicles.length,
        avgDailyKm: g.avgDailyKm
      }))
    };
    sessionStorage.setItem('telematics_prefill', JSON.stringify(telematicsData));
    
    // Navigate to scenario creation with telematics source
    navigate('/dashboard/scenarios/new?source=telematics&prefill=true');
  };

  const handleGenerateAutoScenarios = async () => {
    if (!user) {
      toast.error(t('common.loginRequired'));
      return;
    }

    setIsGenerating(true);
    try {
      const result = await createScenariosFromTelematics(
        user.id,
        groups,
        recommendations
      );

      toast.success(t('telematics.autoScenarios.success'), {
        description: t('telematics.autoScenarios.successDesc', { count: result.scenarios.length }),
      });

      // Navigate to the new project
      navigate(`/dashboard/projects/${result.projectId}`);
    } catch (error: any) {
      console.error('Error generating scenarios:', error);
      toast.error(t('telematics.autoScenarios.error'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {t('telematics.autoScenarios.title')}
            </CardTitle>
            <CardDescription>{t('telematics.autoScenarios.subtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fleet Analysis Summary */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            {t('telematics.autoScenarios.fleetAnalysis')}
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  {t('telematics.autoScenarios.shortRange')}
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {shortRange?.vehicles.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">BEV</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  {t('telematics.autoScenarios.mediumRange')}
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {mediumRange?.vehicles.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">BEV/FCEV</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Fuel className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                  {t('telematics.autoScenarios.longRange')}
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {longRange?.vehicles.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">FCEV</p>
            </div>
          </div>
        </div>

        {/* Potential Savings */}
        <div className="p-4 rounded-lg bg-muted/50">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            {t('telematics.autoScenarios.potentialSavings')}
          </h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-lg font-bold text-foreground">
                  ${potentialSavings.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('telematics.autoScenarios.tcoSavings10y')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-lg font-bold text-foreground">
                  {potentialCo2Reduction.toLocaleString()} kg
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('telematics.autoScenarios.co2Reduction')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Two distinct paths */}
        <div className="space-y-3">
          {/* Primary: Custom Scenario */}
          <Button 
            onClick={handleCreateCustomScenario}
            className="w-full"
            size="lg"
          >
            <Pencil className="w-4 h-4 mr-2" />
            {t('telematics.autoScenarios.createCustom')}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {t('telematics.autoScenarios.createCustomDesc')}
          </p>

          {/* Secondary: Auto-generate */}
          <div className="pt-3 border-t">
            <Button 
              onClick={handleGenerateAutoScenarios} 
              disabled={isGenerating}
              variant="outline"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('telematics.autoScenarios.generating')}
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  {t('telematics.autoScenarios.generateAuto')}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {t('telematics.autoScenarios.generateAutoDesc')}
            </p>
            
            {/* Scenarios Preview for auto-generate */}
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                100% BEV
              </Badge>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 text-xs">
                100% FCEV
              </Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs">
                Mixed
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
