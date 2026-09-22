import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Zap, Fuel, Building2, SkipForward } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface InfraData {
  evChargers: number;
  evCost: number;
  h2Stations: number;
  h2Cost: number;
  totalCost: number;
}

interface WizardInfraStepProps {
  scenarioId: string;
  onComplete: (infraData: InfraData | null) => void;
  onBack: () => void;
  onSkip: () => void;
}

const WizardInfraStep = ({ scenarioId, onComplete, onBack, onSkip }: WizardInfraStepProps) => {
  const { t } = useTranslation();
  const [infraData, setInfraData] = useState<InfraData | null>(null);

  // Fetch scenario to estimate infrastructure
  const { data: scenario } = useQuery({
    queryKey: ['wizard-infra-scenario', scenarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();
      if (error) throw error;

      // Calculate infrastructure based on fleet composition
      const fleetComp = data.fleet_composition as Record<string, { count: number; annualKm: number }>;
      
      const evCount = fleetComp.ev?.count || 0;
      const h2Count = fleetComp.hydrogen?.count || 0;

      // Simple infrastructure estimation
      const evChargers = Math.ceil(evCount / 3); // 1 charger per 3 EVs
      const evCostPerCharger = 75000; // Fast charger cost
      const evCost = evChargers * evCostPerCharger;

      const h2Stations = Math.max(1, Math.ceil(h2Count / 20)); // 1 station per 20 FCEVs
      const h2CostPerStation = 2000000; // H2 station cost
      const h2Cost = h2Stations * h2CostPerStation;

      const estimated: InfraData = {
        evChargers,
        evCost,
        h2Stations,
        h2Cost,
        totalCost: evCost + h2Cost,
      };

      setInfraData(estimated);
      return data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t('wizard.infra.title', 'Step 4: Infrastructure')}
        </h2>
        <p className="text-muted-foreground">
          {t('wizard.infra.subtitle', 'Estimated charging and refueling infrastructure')}
        </p>
      </div>

      {infraData && (
        <>
          {/* Infrastructure Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {infraData.evChargers > 0 && (
              <Card className="border-chart-ev/30">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-chart-ev/10 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-chart-ev" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t('wizard.infra.evCharging', 'EV Charging')}</CardTitle>
                      <CardDescription>{t('wizard.infra.fastChargers', 'DC Fast Chargers')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('wizard.infra.quantity', 'Quantity')}</span>
                      <span className="font-medium">{infraData.evChargers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('wizard.infra.estimatedCost', 'Estimated Cost')}</span>
                      <span className="font-bold text-chart-ev">{formatCurrency(infraData.evCost)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {infraData.h2Stations > 0 && (
              <Card className="border-chart-h2/30">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-chart-h2/10 flex items-center justify-center">
                      <Fuel className="w-6 h-6 text-chart-h2" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t('wizard.infra.h2Refueling', 'H₂ Refueling')}</CardTitle>
                      <CardDescription>{t('wizard.infra.h2Stations', 'Hydrogen Stations')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('wizard.infra.quantity', 'Quantity')}</span>
                      <span className="font-medium">{infraData.h2Stations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('wizard.infra.estimatedCost', 'Estimated Cost')}</span>
                      <span className="font-bold text-chart-h2">{formatCurrency(infraData.h2Cost)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Total */}
          <Card className="bg-muted/50">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                  <span className="text-lg font-medium">{t('wizard.infra.totalInvestment', 'Total Infrastructure Investment')}</span>
                </div>
                <span className="text-2xl font-bold text-primary">{formatCurrency(infraData.totalCost)}</span>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground text-center">
            {t('wizard.infra.note', 'These are estimates based on industry averages. Actual costs may vary based on location and requirements.')}
          </p>
        </>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('wizard.back', 'Back')}
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onSkip} className="gap-2">
            <SkipForward className="w-4 h-4" />
            {t('wizard.skip', 'Skip')}
          </Button>
          <Button
            onClick={() => onComplete(infraData)}
            disabled={!infraData}
            size="lg"
          >
            {t('wizard.continue', 'Continue')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WizardInfraStep;
