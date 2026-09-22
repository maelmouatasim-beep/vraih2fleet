import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  Settings2, 
  Zap, 
  Fuel, 
  Building2, 
  Thermometer, 
  BadgeDollarSign, 
  TrendingUp,
  Battery,
  Clock,
  Gauge
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TCOResult, Region } from '@/lib/calculations/types';
import { formatCurrency, getCurrencyLabel } from '@/lib/currency';
import { MultiplierSummaryCard } from './MultiplierSummaryCard';
import { MultiplierOverride } from '@/lib/calculations/configurableMultipliers';

interface CalculationParametersCardProps {
  result: TCOResult;
  region: Region;
  analysisYears: number;
  discountRate?: number;
  /** Optional multiplier overrides that were applied to this calculation */
  appliedMultipliers?: Record<string, MultiplierOverride>;
}

export function CalculationParametersCard({ 
  result, 
  region, 
  analysisYears, 
  discountRate = 5,
  appliedMultipliers,
}: CalculationParametersCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const currencyLabel = getCurrencyLabel(region);
  const fmtCurrency = (value: number) => formatCurrency(value, region);
  
  const activeParams = result.activeAdvancedParams;
  const appliedConsumption = result.appliedConsumption;
  
  // Count active advanced params
  const activeCount = activeParams ? Object.values(activeParams).filter(Boolean).length : 0;
  
  return (
    <Card className="border-l-4 border-l-violet-500">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('scenarios.params.title', 'Calculation Parameters')}
              {activeCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {t('scenarios.params.advancedCount', '{{count}} advanced parameter(s)', { count: activeCount })}
                </Badge>
              )}
            </CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Active Advanced Parameters Badges */}
            {activeParams && activeCount > 0 && (
              <div className="flex flex-wrap gap-2 pb-3 border-b">
                {activeParams.customConsumption && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Gauge className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.customConsumption', 'Custom consumption')}
                  </Badge>
                )}
                {activeParams.fcStackReplacement && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Battery className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.fcStackReplacement', 'FC stack replacement')}
                  </Badge>
                )}
                {activeParams.h2Inflation && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.h2Inflation', 'H₂ inflation')}
                  </Badge>
                )}
                {activeParams.h2InfraScale && (
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    <Building2 className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.h2InfraScale', 'H₂ scale economies')}
                  </Badge>
                )}
                {activeParams.customInfra && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <Building2 className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.customInfra', 'Custom infrastructure')}
                  </Badge>
                )}
                {activeParams.touRates && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <Clock className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.touRates', 'TOU rates')}
                  </Badge>
                )}
                {activeParams.carbonCredits && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <BadgeDollarSign className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.carbonCredits', 'Carbon credits')}
                  </Badge>
                )}
                {activeParams.coldWeather && (
                  <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                    <Thermometer className="h-3 w-3 mr-1" />
                    {t('scenarios.params.badges.coldWeather', 'Cold impact')}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Financial Parameters */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t('scenarios.params.financial.title', 'Financial parameters')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('scenarios.params.financial.analysisHorizon', 'Analysis horizon')}
                  </p>
                  <p className="text-sm font-semibold">
                    {analysisYears} {t('common.years', 'years')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('scenarios.params.financial.discountRate', 'Discount rate')}
                  </p>
                  <p className="text-sm font-semibold">{discountRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('scenarios.params.financial.residualValue', 'Residual value')}
                  </p>
                  <p className="text-sm font-semibold">{fmtCurrency(result.residualValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('scenarios.params.financial.currency', 'Currency')}
                  </p>
                  <p className="text-sm font-semibold">{currencyLabel}</p>
                </div>
              </div>
            </div>
            
            {/* Applied Consumption Rates */}
            {appliedConsumption && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('scenarios.params.consumption.title', 'Applied consumption')}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {appliedConsumption.diesel !== undefined && appliedConsumption.diesel > 0 && (
                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Diesel</p>
                        <p className="text-sm font-semibold">{appliedConsumption.diesel.toFixed(1)} L/100km</p>
                      </div>
                    </div>
                  )}
                  {appliedConsumption.bev !== undefined && appliedConsumption.bev > 0 && (
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">BEV</p>
                        <p className="text-sm font-semibold">
                          {appliedConsumption.bev.toFixed(1)} kWh/100km
                          {activeParams?.customConsumption && (
                            <span className="text-xs text-emerald-600 ml-1">
                              {t('scenarios.params.consumption.custom', '(custom)')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  {appliedConsumption.h2 !== undefined && appliedConsumption.h2 > 0 && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">H₂</p>
                        <p className="text-sm font-semibold">
                          {appliedConsumption.h2.toFixed(2)} kg/100km
                          {activeParams?.customConsumption && (
                            <span className="text-xs text-emerald-600 ml-1">
                              {t('scenarios.params.consumption.custom', '(custom)')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Infrastructure Costs */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t('scenarios.params.infrastructure.title', 'Infrastructure costs')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('scenarios.params.infrastructure.total', 'Total infrastructure')}
                  </p>
                  <p className="text-sm font-semibold">
                    {result.totalInfrastructureCost > 0 
                      ? fmtCurrency(result.totalInfrastructureCost) 
                      : t('scenarios.params.infrastructure.notEstimated', 'Not estimated')
                    }
                    {activeParams?.customInfra && (
                      <span className="text-xs text-purple-600 ml-1">
                        {t('scenarios.params.consumption.custom', '(custom)')}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('scenarios.params.infrastructure.evChargers', 'EV Chargers')}
                  </p>
                  <p className="text-sm font-semibold">{result.chargingStations} × {fmtCurrency(result.chargingStationsCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('scenarios.params.infrastructure.h2Stations', 'H₂ Stations')}
                  </p>
                  <p className="text-sm font-semibold">{result.h2Stations} × {fmtCurrency(result.h2StationsCost)}</p>
                </div>
                {result.h2InfraScaleDiscount && result.h2InfraScaleDiscount > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('scenarios.params.infrastructure.h2ScaleEconomies', 'H₂ scale economies')}
                    </p>
                    <p className="text-sm font-semibold text-green-600">-{fmtCurrency(result.h2InfraScaleDiscount)}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* H2-specific parameters if applicable */}
            {(result.fcStackReplacementCost && result.fcStackReplacementCost > 0) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('scenarios.params.h2Advanced.title', 'Advanced H₂ parameters')}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {result.fcStackReplacementCost > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t('scenarios.params.h2Advanced.fcStackReplacement', 'FC stack replacement')}
                      </p>
                      <p className="text-sm font-semibold text-destructive">+{fmtCurrency(result.fcStackReplacementCost)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Multiplier Summary - show which multipliers were used */}
            {appliedMultipliers && Object.keys(appliedMultipliers).length > 0 && (
              <div className="pt-2 border-t">
                <MultiplierSummaryCard 
                  appliedMultipliers={appliedMultipliers}
                  title={t('scenarios.params.multipliersUsed', 'Calculation Multipliers')}
                />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
