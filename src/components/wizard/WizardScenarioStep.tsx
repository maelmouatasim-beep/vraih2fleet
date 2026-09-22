import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Fuel, Battery } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WizardScenarioStepProps {
  projectId: string;
  onComplete: (scenarioId: string) => void;
  onBack: () => void;
}

type PowertrainTemplate = 'ev' | 'hydrogen' | 'mixed';

const WizardScenarioStep = ({ projectId, onComplete, onBack }: WizardScenarioStepProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [scenarioName, setScenarioName] = useState('');
  const [template, setTemplate] = useState<PowertrainTemplate>('ev');
  const [vehicleCount, setVehicleCount] = useState(10);
  const [annualKm, setAnnualKm] = useState(80000);

  const templates = [
    {
      id: 'ev' as const,
      icon: Battery,
      label: t('wizard.scenario.templates.ev', '100% Electric'),
      description: t('wizard.scenario.templates.evDesc', 'Full battery electric transition'),
      color: 'text-chart-ev',
      bgColor: 'bg-chart-ev/10',
    },
    {
      id: 'hydrogen' as const,
      icon: Fuel,
      label: t('wizard.scenario.templates.hydrogen', '100% Hydrogen'),
      description: t('wizard.scenario.templates.hydrogenDesc', 'Full fuel cell electric transition'),
      color: 'text-chart-h2',
      bgColor: 'bg-chart-h2/10',
    },
    {
      id: 'mixed' as const,
      icon: Zap,
      label: t('wizard.scenario.templates.mixed', 'Mixed Fleet'),
      description: t('wizard.scenario.templates.mixedDesc', '50% electric, 50% hydrogen'),
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  const createMutation = useMutation({
    mutationFn: async () => {
      // Build fleet composition based on template
      const fleetComposition: Record<string, { count: number; annualKm: number }> = {};
      
      if (template === 'ev') {
        fleetComposition.ev = { count: vehicleCount, annualKm };
      } else if (template === 'hydrogen') {
        fleetComposition.hydrogen = { count: vehicleCount, annualKm };
      } else {
        const evCount = Math.ceil(vehicleCount / 2);
        const h2Count = vehicleCount - evCount;
        fleetComposition.ev = { count: evCount, annualKm };
        fleetComposition.hydrogen = { count: h2Count, annualKm };
      }

      const { data, error } = await supabase
        .from('scenarios')
        .insert({
          name: scenarioName.trim() || `${templates.find(t => t.id === template)?.label} Scenario`,
          project_id: projectId,
          fleet_composition: fleetComposition,
          analysis_years: 10,
          discount_rate: 5,
          region: 'QC',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      toast({
        title: t('wizard.scenario.created', 'Scenario created'),
        description: t('wizard.scenario.createdDesc', 'Your scenario has been created successfully'),
      });
      onComplete(data.id);
    },
    onError: (error) => {
      console.error('Create scenario error:', error);
      toast({
        title: t('wizard.scenario.error', 'Error'),
        description: t('wizard.scenario.errorDesc', 'Failed to create scenario'),
        variant: 'destructive',
      });
    },
  });

  const handleContinue = () => {
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t('wizard.scenario.title', 'Step 2: Scenario')}
        </h2>
        <p className="text-muted-foreground">
          {t('wizard.scenario.subtitle', 'Define your transition scenario parameters')}
        </p>
      </div>

      {/* Template Selection */}
      <div className="space-y-3">
        <Label>{t('wizard.scenario.templateLabel', 'Transition Type')}</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => setTemplate(tpl.id)}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all duration-200",
                template === tpl.id 
                  ? "border-primary bg-primary/5" 
                  : "border-muted hover:border-primary/30"
              )}
            >
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", tpl.bgColor)}>
                <tpl.icon className={cn("w-5 h-5", tpl.color)} />
              </div>
              <p className="font-medium text-foreground">{tpl.label}</p>
              <p className="text-sm text-muted-foreground">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Parameters Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('wizard.scenario.params', 'Fleet Parameters')}</CardTitle>
          <CardDescription>
            {t('wizard.scenario.paramsDesc', 'Configure your fleet size and usage')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="scenario-name">{t('wizard.scenario.nameLabel', 'Scenario Name (optional)')}</Label>
            <Input
              id="scenario-name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder={t('wizard.scenario.namePlaceholder', 'e.g., Phase 1 Electrification')}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>{t('wizard.scenario.vehicleCount', 'Number of Vehicles')}</Label>
              <span className="text-sm font-medium text-primary">{vehicleCount}</span>
            </div>
            <Slider
              value={[vehicleCount]}
              onValueChange={([v]) => setVehicleCount(v)}
              min={1}
              max={200}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>200</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>{t('wizard.scenario.annualKm', 'Annual Mileage per Vehicle')}</Label>
              <span className="text-sm font-medium text-primary">{annualKm.toLocaleString()} km</span>
            </div>
            <Slider
              value={[annualKm]}
              onValueChange={([v]) => setAnnualKm(v)}
              min={10000}
              max={200000}
              step={5000}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10,000 km</span>
              <span>200,000 km</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('wizard.back', 'Back')}
        </Button>
        <Button
          onClick={handleContinue}
          disabled={createMutation.isPending}
          size="lg"
        >
          {createMutation.isPending 
            ? t('wizard.creating', 'Creating...') 
            : t('wizard.continue', 'Continue')
          }
        </Button>
      </div>
    </div>
  );
};

export default WizardScenarioStep;
