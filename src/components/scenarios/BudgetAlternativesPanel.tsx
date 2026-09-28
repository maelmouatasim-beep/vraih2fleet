import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowRightLeft, 
  TrendingDown, 
  Calendar, 
  Fuel,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Leaf,
} from 'lucide-react';
import { BudgetAlternative } from '@/lib/recommendations/thresholds';
import { Region } from '@/lib/calculations/types';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface BudgetAlternativesPanelProps {
  alternatives: BudgetAlternative[];
  region: Region;
  deficit: number;
}

const iconMap: Record<string, React.ElementType> = {
  swap_h2_to_ev: ArrowRightLeft,
  reduce_h2_minimal: TrendingDown,
  reduce_ev: TrendingDown,
  mix_reduction: TrendingDown,
  add_diesel_temp: Fuel,
  phased_deployment: Calendar,
};

const impactColors: Record<string, string> = {
  maintained: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30',
  reduced: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30',
  increased: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
  deferred: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
};

export function BudgetAlternativesPanel({ 
  alternatives, 
  region, 
  deficit 
}: BudgetAlternativesPanelProps) {
  const { t } = useTranslation();

  if (alternatives.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        {t('scenarios.recommendations.alternatives.title', 'Alternatives pour réduire le CAPEX')}
        <Badge variant="outline" className="text-xs">
          {alternatives.length} {t('scenarios.recommendations.alternatives.options', 'options')}
        </Badge>
      </h4>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {alternatives.map((alt, index) => {
          const Icon = iconMap[alt.id] || TrendingDown;
          const isOptimal = index === 0 && alt.resolvesDeficit && alt.impactCO2 === 'maintained';
          
          return (
            <Card 
              key={alt.id} 
              className={cn(
                'relative overflow-hidden transition-all hover:shadow-md',
                isOptimal && 'ring-2 ring-primary/50'
              )}
            >
              {isOptimal && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-bl">
                  {t('scenarios.recommendations.alternatives.optimal', 'Optimal')}
                </div>
              )}
              
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {alt.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="px-4 pb-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  {alt.description}
                </p>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {t('scenarios.recommendations.alternatives.savings', 'Économie')}:
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(alt.savings, region)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {t('scenarios.recommendations.alternatives.newCapex', 'Nouveau CAPEX')}:
                      </span>
                      <span className="font-medium">
                        {formatCurrency(alt.newCapex, region)}
                      </span>
                    </div>
                  </div>
                  
                  {alt.resolvesDeficit ? (
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t('scenarios.recommendations.alternatives.resolved', 'Résolu')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 border-yellow-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {t('scenarios.recommendations.alternatives.partial', 'Partiel')}
                    </Badge>
                  )}
                </div>
                
                {/* CO2 Impact */}
                <div className={cn(
                  'flex items-center gap-2 text-xs px-2 py-1 rounded',
                  impactColors[alt.impactCO2]
                )}>
                  <Leaf className="h-3 w-3" />
                  {alt.impactCO2Label}
                </div>
                
                {/* Action button */}
                {alt.actionType === 'roadmap' ? (
                  <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                    <Link to="/dashboard/roadmap">
                      {t('scenarios.recommendations.alternatives.viewRoadmap', 'Planifier le déploiement')}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                ) : alt.actionType === 'subsidies' ? (
                  <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                    <Link to="/dashboard/projects">
                      {t('scenarios.recommendations.alternatives.viewSubsidies', 'Explorer les subventions')}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                    {t('scenarios.recommendations.alternatives.simulate', 'Simuler ce scénario')}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
