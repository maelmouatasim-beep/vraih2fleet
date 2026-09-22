import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TCOResult, Region } from '@/lib/calculations/types';
import { formatCurrency } from '@/lib/currency';
import { TrendingDown, TrendingUp, Fuel, Scale, Calculator, ChevronDown, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BaselineComparisonCardProps {
  result: TCOResult;
  region: Region;
}

export function BaselineComparisonCard({ result, region }: BaselineComparisonCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const fmtCurrency = (value: number) => formatCurrency(value, region);
  
  // Check if baseline comparison data exists
  if (!result.baselineTco || result.baselineTco === 0) {
    return null;
  }
  
  const tcoSavings = result.tcoSavings || 0;
  const hasSavings = tcoSavings > 0;
  const savingsPercent = result.baselineTco > 0 
    ? Math.abs(tcoSavings / result.baselineTco * 100) 
    : 0;

  const breakdown = result.baselineBreakdown;
  
  return (
    <Card className={`border-l-4 ${hasSavings ? 'border-l-green-500' : 'border-l-orange-500'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4" />
          {t('scenarios.comparison.title', 'Comparison with Diesel baseline')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Baseline TCO (100% Diesel) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">
                {t('scenarios.comparison.baselineTco', 'Baseline TCO (100% Diesel)')}
              </p>
            </div>
            <p className="text-lg font-semibold text-muted-foreground">
              {fmtCurrency(result.baselineTco)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('scenarios.comparison.if100Diesel', 'If fleet 100% diesel')}
            </p>
          </div>
          
          {/* Current Scenario TCO */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {t('scenarios.comparison.currentScenarioTco', 'Current scenario TCO')}
              </p>
            </div>
            <p className="text-lg font-bold text-primary">
              {fmtCurrency(result.tcoTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('scenarios.comparison.currentMix', 'Current mix')}
            </p>
          </div>
          
          {/* Difference */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {hasSavings ? (
                <TrendingDown className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-orange-500" />
              )}
              <p className="text-xs text-muted-foreground">
                {hasSavings 
                  ? t('scenarios.comparison.tcoSavings', 'TCO Savings') 
                  : t('scenarios.comparison.tcoCostIncrease', 'TCO Cost Increase')
                }
              </p>
            </div>
            <p className={`text-lg font-bold ${hasSavings ? 'text-green-600' : 'text-orange-600'}`}>
              {hasSavings ? '-' : '+'}{fmtCurrency(Math.abs(tcoSavings))}
            </p>
            <p className="text-xs text-muted-foreground">
              {savingsPercent.toFixed(1)}% {hasSavings 
                ? t('scenarios.comparison.less', 'less') 
                : t('scenarios.comparison.more', 'more')
              }
            </p>
          </div>
          
          {/* Visual Indicator */}
          <div className="flex items-center justify-center">
            <Badge 
              variant={hasSavings ? 'default' : 'secondary'}
              className={`text-sm px-4 py-2 ${hasSavings ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
            >
              {hasSavings ? (
                <>
                  <TrendingDown className="h-4 w-4 mr-1" />
                  {t('scenarios.comparison.savings', 'Savings')}
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {t('scenarios.comparison.investment', 'Investment')}
                </>
              )}
            </Badge>
          </div>
        </div>
        
        {/* Explanation */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>{t('scenarios.comparison.noteLabel', 'Note:')}</strong> {t('scenarios.comparison.note', 'The baseline represents the total cost of ownership if the fleet remained 100% diesel over the analysis period.')} {hasSavings 
              ? t('scenarios.comparison.noteNetSavings', 'Your transition scenario generates net savings.') 
              : t('scenarios.comparison.noteHigherInvestment', 'The cost increase includes higher initial investments that may be offset by long-term operational savings.')
            }
          </p>
        </div>

        {/* Methodology Section - Collapsible */}
        {breakdown && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pt-3 border-t w-full">
              <Calculator className="h-4 w-4" />
              <span>{t('scenarios.comparison.viewMethodology', 'View calculation details')}</span>
              <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-4 space-y-4 bg-muted/30 p-4 rounded-lg">
              {/* Methodology Explanation */}
              <div className="text-sm space-y-2">
                <p className="font-medium">{t('scenarios.comparison.methodology', 'Methodology:')}</p>
                <p className="text-muted-foreground text-xs">
                  {t('scenarios.comparison.methodologyText', 
                    'The baseline TCO represents the total cost if the fleet remained 100% diesel. It uses the Net Present Value (NPV) method to compare financial flows over time.'
                  )}
                </p>
              </div>
              
              {/* Breakdown Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-2 font-medium">{t('scenarios.comparison.component', 'Component')}</th>
                      <th className="pb-2 text-right font-medium">{t('scenarios.comparison.nominal', 'Nominal')}</th>
                      <th className="pb-2 text-right font-medium">{t('scenarios.comparison.pv', 'Present Value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2">{t('scenarios.comparison.dieselCapex', 'Diesel CAPEX')}</td>
                      <td className="text-right">{fmtCurrency(breakdown.capex)}</td>
                      <td className="text-right">{fmtCurrency(breakdown.capex)}</td>
                    </tr>
                    <tr>
                      <td className="py-2">{t('scenarios.comparison.dieselOpex', 'OPEX (fuel + maintenance)')}</td>
                      <td className="text-right">{fmtCurrency(breakdown.opexNominal)}</td>
                      <td className="text-right">{fmtCurrency(breakdown.opexPV)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-green-600">{t('scenarios.comparison.residualValue', 'Residual value')}</td>
                      <td className="text-right text-green-600">-{fmtCurrency(breakdown.residualNominal)}</td>
                      <td className="text-right text-green-600">-{fmtCurrency(breakdown.residualPV)}</td>
                    </tr>
                    <tr className="border-t font-bold">
                      <td className="pt-2">{t('scenarios.comparison.total', 'Total TCO')}</td>
                      <td className="pt-2 text-right">{fmtCurrency(breakdown.totalNominal)}</td>
                      <td className="pt-2 text-right text-primary">{fmtCurrency(result.baselineTco || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Formula */}
              <div className="bg-muted p-3 rounded text-xs font-mono">
                TCO<sub>baseline</sub> = CAPEX + PV(OPEX) - PV(Valeur résiduelle)
              </div>
              
              {/* Parameters Used */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{t('scenarios.comparison.discountRateLabel', 'Discount rate:')} {breakdown.discountRate.toFixed(1)}%</p>
                <p>{t('scenarios.comparison.inflationRateLabel', 'Energy inflation:')} {breakdown.inflationRate.toFixed(1)}%</p>
              </div>
              
              {/* Expert Note */}
              <div className="flex gap-2 text-xs text-muted-foreground border-l-2 border-amber-500 pl-3">
                <Info className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                <p>
                  <strong>{t('scenarios.comparison.noteExpert', 'Note:')}</strong>{' '}
                  {t('scenarios.comparison.noteExpertText', 
                    'The nominal value allows direct comparison with external estimates. The present value (displayed by default) is recommended for financial decisions as it accounts for the time value of money.'
                  )}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
