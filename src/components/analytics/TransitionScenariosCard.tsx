import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TransitionScenario } from "@/hooks/useEnhancedAnalytics";
import { Zap, TrendingUp, Leaf, ArrowRight, DollarSign, Clock, ExternalLink, Award } from "lucide-react";

interface TransitionScenariosCardProps {
  scenarios: TransitionScenario[];
  onSelectScenario?: (scenario: TransitionScenario) => void;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value}`;
};

const scenarioColors = {
  rapid: 'border-purple-500 bg-purple-50 dark:bg-purple-950/20',
  progressive: 'border-green-500 bg-green-50 dark:bg-green-950/20',
  conservative: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
  custom: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20',
};

const scenarioBadgeColors = {
  rapid: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  progressive: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  conservative: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  custom: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

const TransitionScenariosCard = ({ scenarios, onSelectScenario }: TransitionScenariosCardProps) => {
  const { t } = useTranslation();

  // Find best scenarios for highlighting
  const lowestTco = scenarios.length > 0 
    ? Math.min(...scenarios.filter(s => s.tcoTotal && s.tcoTotal > 0).map(s => s.tcoTotal || Infinity))
    : null;
  const highestCo2Reduction = scenarios.length > 0
    ? Math.max(...scenarios.map(s => s.co2Reduction || 0))
    : null;
  const lowestPayback = scenarios.length > 0
    ? Math.min(...scenarios.filter(s => s.paybackYears && s.paybackYears > 0).map(s => s.paybackYears || Infinity))
    : null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'rapid': return '100% BEV';
      case 'progressive': return '100% FCEV';
      case 'conservative': return 'Mixed';
      default: return 'Custom';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('analytics.transitions.title', 'Scénarios de Transition')}
          {scenarios.some(s => s.isRealScenario) && (
            <Badge variant="outline" className="text-xs">
              {t('analytics.transitions.realData', 'Données réelles')}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {scenarios.some(s => s.isRealScenario) 
            ? t('analytics.transitions.descriptionReal', 'Comparez vos scénarios créés')
            : t('analytics.transitions.description', 'Comparez différentes stratégies de décarbonation')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Quick Comparison Table */}
        {scenarios.length > 1 && scenarios.some(s => s.tcoTotal && s.tcoTotal > 0) && (
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-sm border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Scénario</th>
                  <th className="text-right p-2 font-medium">TCO Total</th>
                  <th className="text-right p-2 font-medium">CO₂ Évité</th>
                  <th className="text-right p-2 font-medium">Payback</th>
                  <th className="text-right p-2 font-medium">CAPEX</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario) => (
                  <tr key={scenario.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 font-medium">{scenario.name}</td>
                    <td className="p-2 text-right">
                      <span className="flex items-center justify-end gap-1">
                        {scenario.tcoTotal === lowestTco && lowestTco && (
                          <Award className="w-3 h-3 text-yellow-500" />
                        )}
                        {scenario.tcoTotal ? formatCurrency(scenario.tcoTotal) : '-'}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <span className="flex items-center justify-end gap-1 text-green-600">
                        {scenario.co2Reduction === highestCo2Reduction && highestCo2Reduction && highestCo2Reduction > 0 && (
                          <Award className="w-3 h-3 text-yellow-500" />
                        )}
                        {scenario.co2Reduction ? `${Math.round(scenario.co2Reduction)}t` : '-'}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <span className="flex items-center justify-end gap-1">
                        {scenario.paybackYears === lowestPayback && lowestPayback && lowestPayback < Infinity && (
                          <Award className="w-3 h-3 text-yellow-500" />
                        )}
                        {scenario.paybackYears ? `${scenario.paybackYears.toFixed(1)} yrs` : '-'}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {scenario.capex ? formatCurrency(scenario.capex) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`p-4 rounded-lg border-2 ${scenarioColors[scenario.type]} transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold">{scenario.name}</h4>
                  <Badge className={`${scenarioBadgeColors[scenario.type]} mt-1`}>
                    {getTypeLabel(scenario.type)}
                  </Badge>
                </div>
                <Zap className={`w-5 h-5 ${
                  scenario.type === 'rapid' ? 'text-purple-500' :
                  scenario.type === 'progressive' ? 'text-green-500' : 
                  scenario.type === 'conservative' ? 'text-blue-500' : 'text-orange-500'
                }`} />
              </div>

              {/* Fleet Mix */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span>BEV</span>
                  <span className="font-medium">{scenario.bevPercent}%</span>
                </div>
                <Progress value={scenario.bevPercent} className="h-2" />
                
                <div className="flex justify-between text-xs">
                  <span>FCEV</span>
                  <span className="font-medium">{scenario.fcevPercent}%</span>
                </div>
                <Progress value={scenario.fcevPercent} className="h-2" />
                
                {scenario.dieselPercent > 0 && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>Diesel</span>
                      <span className="font-medium">{scenario.dieselPercent}%</span>
                    </div>
                    <Progress value={scenario.dieselPercent} className="h-2 [&>div]:bg-muted-foreground" />
                  </>
                )}
              </div>

              {/* KPIs for real scenarios */}
              {scenario.isRealScenario && (scenario.tcoTotal || scenario.capex) && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {scenario.tcoTotal && scenario.tcoTotal > 0 && (
                    <div className="text-center p-2 rounded bg-background/50">
                      <DollarSign className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-xs text-muted-foreground">TCO</p>
                      <p className="font-semibold text-sm">{formatCurrency(scenario.tcoTotal)}</p>
                    </div>
                  )}
                  {scenario.paybackYears && (
                    <div className="text-center p-2 rounded bg-background/50">
                      <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-xs text-muted-foreground">Payback</p>
                      <p className="font-semibold text-sm">{scenario.paybackYears.toFixed(1)} yrs</p>
                    </div>
                  )}
                </div>
              )}

              {/* Benefits - TCO Total as primary, CO2 as secondary */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="text-center p-2 rounded bg-background/50">
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">{t('analytics.transitions.tcoTotal', 'TCO Total')}</p>
                  <p className="font-semibold text-sm">{scenario.tcoTotal ? formatCurrency(scenario.tcoTotal) : '-'}</p>
                </div>
                <div className="text-center p-2 rounded bg-background/50">
                  <Leaf className="w-4 h-4 mx-auto mb-1 text-green-600" />
                  <p className="text-xs text-muted-foreground">CO₂</p>
                  <p className="font-semibold text-sm">-{Math.round(scenario.co2Reduction)}t</p>
                </div>
              </div>

              {scenario.isRealScenario ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  asChild
                >
                  <Link to={`/dashboard/scenario/${scenario.id}`}>
                    <ExternalLink className="w-3 h-3 mr-2" />
                    {t('analytics.transitions.viewDetails', 'Voir détails')}
                  </Link>
                </Button>
              ) : onSelectScenario && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => onSelectScenario(scenario)}
                >
                  {t('analytics.transitions.apply', 'Appliquer')}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TransitionScenariosCard;
