import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calculator, TrendingDown, Leaf, DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { calculateTCO } from "@/lib/calculations/tco";
import { DEFAULT_REFERENCE_DATA } from "@/lib/calculations/types";
import type { Scenario, FleetComposition, Region } from "@/lib/calculations/types";
import { toast } from "@/hooks/use-toast";

interface TCOData {
  tco_total: number;
  capex: number;
  opex_total: number;
  co2_total: number;
  co2_savings: number;
  payback_period_years: number | null;
}

interface WizardTCOStepProps {
  scenarioId: string;
  onComplete: (tcoData: TCOData) => void;
  onBack: () => void;
}

const WizardTCOStep = ({ scenarioId, onComplete, onBack }: WizardTCOStepProps) => {
  const { t } = useTranslation();
  const [tcoResult, setTcoResult] = useState<TCOData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch scenario
  const { data: scenario } = useQuery({
    queryKey: ['wizard-scenario', scenarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Auto-calculate on mount
  useEffect(() => {
    if (scenario && !tcoResult && !isCalculating) {
      calculateTCOForScenario();
    }
  }, [scenario]);

  const calculateTCOForScenario = async () => {
    if (!scenario) return;
    
    setIsCalculating(true);
    try {
      const fleetComp = scenario.fleet_composition as Record<string, { count: number; annualKm: number }>;
      
      // Build fleet composition
      const fleetComposition: FleetComposition = {
        diesel: { count: fleetComp.diesel?.count || 0, annualKm: fleetComp.diesel?.annualKm || 0 },
        ev: { count: fleetComp.ev?.count || 0, annualKm: fleetComp.ev?.annualKm || 0 },
        hydrogen: { count: fleetComp.hydrogen?.count || 0, annualKm: fleetComp.hydrogen?.annualKm || 0 },
      };

      const scenarioForCalc: Scenario = {
        id: scenario.id,
        projectId: scenario.project_id,
        name: scenario.name,
        region: (scenario.region || 'Canada') as Region,
        analysisYears: scenario.analysis_years || 10,
        discountRate: scenario.discount_rate || 5,
        fleetComposition,
        createdAt: scenario.created_at,
      };

      const result = calculateTCO(scenarioForCalc, DEFAULT_REFERENCE_DATA);

      const tcoData: TCOData = {
        tco_total: result.tcoTotal,
        capex: result.capex,
        opex_total: result.opexTotal,
        co2_total: result.co2Total,
        co2_savings: result.co2Savings || 0,
        payback_period_years: result.paybackPeriodYears || null,
      };

      // Save to database
      const { error } = await supabase
        .from('tco_results')
        .upsert({
          scenario_id: scenarioId,
          tco_total: tcoData.tco_total,
          capex: tcoData.capex,
          opex_total: tcoData.opex_total,
          co2_total: tcoData.co2_total,
          co2_savings: tcoData.co2_savings,
          payback_period_years: tcoData.payback_period_years,
        }, { onConflict: 'scenario_id' });

      if (error) throw error;

      setTcoResult(tcoData);
      toast({
        title: t('wizard.tco.calculated', 'TCO calculated'),
        description: t('wizard.tco.calculatedDesc', 'Your total cost of ownership has been calculated'),
      });
    } catch (error) {
      console.error('TCO calculation error:', error);
      toast({
        title: t('wizard.tco.error', 'Calculation error'),
        description: t('wizard.tco.errorDesc', 'Failed to calculate TCO'),
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

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
          {t('wizard.tco.title', 'Step 3: TCO Results')}
        </h2>
        <p className="text-muted-foreground">
          {t('wizard.tco.subtitle', 'Review your total cost of ownership analysis')}
        </p>
      </div>

      {isCalculating && (
        <Card className="border-primary/20">
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground">{t('wizard.tco.calculating', 'Calculating TCO...')}</p>
          </CardContent>
        </Card>
      )}

      {tcoResult && (
        <>
          {/* Main TCO Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="text-center">
              <Badge variant="secondary" className="w-fit mx-auto mb-2">
                {t('wizard.tco.totalCost', '10-Year Total Cost')}
              </Badge>
              <CardTitle className="text-4xl font-bold text-primary">
                {formatCurrency(tcoResult.tco_total)}
              </CardTitle>
            </CardHeader>
          </Card>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <DollarSign className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('wizard.tco.capex', 'CAPEX')}</p>
                <p className="text-xl font-bold">{formatCurrency(tcoResult.capex)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Calculator className="w-8 h-8 text-chart-ev mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('wizard.tco.opex', 'OPEX (10yr)')}</p>
                <p className="text-xl font-bold">{formatCurrency(tcoResult.opex_total)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Leaf className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('wizard.tco.co2Savings', 'CO₂ Avoided')}</p>
                <p className="text-xl font-bold text-accent">-{Math.round(tcoResult.co2_savings)} t</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingDown className="w-8 h-8 text-chart-h2 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('wizard.tco.payback', 'Payback')}</p>
                <p className="text-xl font-bold">
                  {tcoResult.payback_period_years 
                    ? `${tcoResult.payback_period_years} ${t('wizard.tco.years', 'yrs')}`
                    : '—'
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Verdict */}
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="py-6 text-center">
              <p className="text-lg font-medium text-foreground">
                {tcoResult.co2_savings > 0 
                  ? t('wizard.tco.verdictPositive', '✓ This transition reduces emissions by {{co2}}t of CO₂ over 10 years', { co2: Math.round(tcoResult.co2_savings) })
                  : t('wizard.tco.verdictNeutral', 'TCO analysis complete')
                }
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('wizard.back', 'Back')}
        </Button>
        <Button
          onClick={() => tcoResult && onComplete(tcoResult)}
          disabled={!tcoResult || isCalculating}
          size="lg"
        >
          {t('wizard.continue', 'Continue')}
        </Button>
      </div>
    </div>
  );
};

export default WizardTCOStep;
