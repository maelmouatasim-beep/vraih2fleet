import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Lightbulb, 
  ChevronDown, 
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { TCOResult, Scenario, Region } from '@/lib/calculations/types';
import { useScenarioRecommendations, ScenarioRecommendation, BudgetStatus } from '@/hooks/useScenarioRecommendations';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { BudgetAlternativesPanel } from './BudgetAlternativesPanel';

interface ScenarioRecommendationsProps {
  result: TCOResult;
  scenario: Scenario | null;
  region: Region;
  maxBudget: number | null;
  className?: string;
}

const priorityColors: Record<string, string> = {
  critical: 'bg-destructive/10 border-destructive text-destructive',
  high: 'bg-orange-50 dark:bg-orange-950/30 border-orange-500 text-orange-700 dark:text-orange-400',
  medium: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-500 text-yellow-700 dark:text-yellow-400',
  low: 'bg-green-50 dark:bg-green-950/30 border-green-500 text-green-700 dark:text-green-400',
};

const priorityBadgeVariants: Record<string, 'destructive' | 'outline' | 'secondary'> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

function RecommendationCard({ 
  recommendation, 
  region,
  isExpanded = false,
}: { 
  recommendation: ScenarioRecommendation; 
  region: Region;
  isExpanded?: boolean;
}) {
  const { t } = useTranslation();
  const Icon = recommendation.icon;
  
  return (
    <div 
      className={cn(
        'p-4 rounded-lg border-l-4 transition-colors',
        priorityColors[recommendation.priority]
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">
              {t(`scenarios.recommendations.${recommendation.title}`, recommendation.title)}
            </h4>
            <Badge variant={priorityBadgeVariants[recommendation.priority]} className="text-xs">
              {t(`scenarios.recommendations.priority.${recommendation.priority}`, recommendation.priority)}
            </Badge>
          </div>
          
          <p className="text-sm mt-1 opacity-90">
            {t(`scenarios.recommendations.${recommendation.description}`, recommendation.description)}
          </p>
          
          {/* Impact and savings */}
          {(recommendation.impact || recommendation.estimatedSavings) && (
            <div className="flex items-center gap-4 mt-2 text-sm">
              {recommendation.impact && (
                <span className="font-medium">
                  {recommendation.impact}
                </span>
              )}
              {recommendation.estimatedSavings && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {t('scenarios.recommendations.estimatedSavings', 'Estimated savings')}: {formatCurrency(recommendation.estimatedSavings, region)}
                </span>
              )}
            </div>
          )}
          
          {/* Action button */}
          {recommendation.actionLink && (
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto mt-2"
              asChild
            >
              <Link to={recommendation.actionLink}>
                {t(`scenarios.recommendations.${recommendation.actionLabel}`, recommendation.actionLabel)}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BudgetAlert({ budgetStatus, region }: { budgetStatus: BudgetStatus; region: Region }) {
  const { t } = useTranslation();
  
  if (!budgetStatus.isOverBudget) return null;
  
  return (
    <Alert variant="destructive" className="animate-in fade-in">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {t('scenarios.budget.exceeded', 'Budget exceeded by {{amount}}', {
          amount: formatCurrency(budgetStatus.delta, region),
        })}
      </AlertTitle>
      <AlertDescription>
        {t('scenarios.budget.exceededDesc', 'Your CAPEX exceeds the defined budget by {{percent}}%. See recommendations below for optimization options.', {
          percent: budgetStatus.percentOver.toFixed(0),
        })}
      </AlertDescription>
    </Alert>
  );
}

export function ScenarioRecommendations({
  result,
  scenario,
  region,
  maxBudget,
  className,
}: ScenarioRecommendationsProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  const { 
    recommendations, 
    budgetAlternatives,
    budgetStatus, 
    hasCriticalIssues,
    hasHighPriority,
  } = useScenarioRecommendations({
    result,
    scenario,
    region,
    maxBudget,
  });
  
  // Don't render if no recommendations
  if (recommendations.length === 0) {
    return null;
  }
  
  // Separate critical/high from medium/low
  const criticalRecommendations = recommendations.filter(r => r.priority === 'critical' || r.priority === 'high');
  const otherRecommendations = recommendations.filter(r => r.priority === 'medium' || r.priority === 'low');
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Budget exceeded alert */}
      {budgetStatus && <BudgetAlert budgetStatus={budgetStatus} region={region} />}
      
      {/* Recommendations panel */}
      <Card className={cn(
        'border-l-4',
        hasCriticalIssues ? 'border-l-destructive' : hasHighPriority ? 'border-l-orange-500' : 'border-l-primary'
      )}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                {t('scenarios.recommendations.title', 'Recommendations')}
                <Badge variant="secondary" className="ml-2">
                  {recommendations.length} {t('scenarios.recommendations.insights', 'insights')}
                </Badge>
                {hasCriticalIssues && (
                  <Badge variant="destructive" className="ml-1">
                    {t('scenarios.recommendations.actionRequired', 'Action required')}
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-180'
              )} />
            </CollapsibleTrigger>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Budget Alternatives Panel (intelligent suggestions) */}
              {budgetStatus?.isOverBudget && budgetAlternatives.length > 0 && (
                <BudgetAlternativesPanel 
                  alternatives={budgetAlternatives} 
                  region={region}
                  deficit={budgetStatus.delta}
                />
              )}
              
              {/* Critical & High priority recommendations */}
              {criticalRecommendations.length > 0 && (
                <div className="space-y-3">
                  {criticalRecommendations.map((rec) => (
                    <RecommendationCard 
                      key={rec.id} 
                      recommendation={rec} 
                      region={region}
                      isExpanded
                    />
                  ))}
                </div>
              )}
              
              {/* Medium & Low priority recommendations */}
              {otherRecommendations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {otherRecommendations.map((rec) => (
                    <RecommendationCard 
                      key={rec.id} 
                      recommendation={rec} 
                      region={region}
                    />
                  ))}
                </div>
              )}
              
              {/* All good message */}
              {!hasCriticalIssues && !hasHighPriority && recommendations.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('scenarios.recommendations.allGood', 'Your scenario looks good! Minor optimizations are suggested below.')}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
