import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { DollarSign, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { Region } from '@/lib/calculations/types';
import { cn } from '@/lib/utils';

interface BudgetConstraintInputProps {
  currentCapex: number;
  maxBudget: number | null;
  onBudgetChange: (budget: number | null) => void;
  region: Region;
  className?: string;
}

export function BudgetConstraintInput({
  currentCapex,
  maxBudget,
  onBudgetChange,
  region,
  className,
}: BudgetConstraintInputProps) {
  const { t } = useTranslation();
  
  const isEnabled = maxBudget !== null;
  const isOverBudget = isEnabled && currentCapex > maxBudget;
  const delta = isEnabled ? currentCapex - maxBudget : 0;
  const percentUsed = isEnabled && maxBudget > 0 ? (currentCapex / maxBudget) * 100 : 0;
  
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Set default budget to current CAPEX + 10%
      onBudgetChange(Math.round(currentCapex * 1.1));
    } else {
      onBudgetChange(null);
    }
  };
  
  const handleBudgetValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue) && numValue > 0) {
      onBudgetChange(numValue);
    } else if (value === '') {
      onBudgetChange(null);
    }
  };
  
  return (
    <Card className={cn('border-l-4', isOverBudget ? 'border-l-destructive' : 'border-l-primary', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {t('scenarios.budget.title', 'Budget Constraint')}
            <InfoTooltip content={t('scenarios.budget.tooltip', 'Set a maximum budget to receive optimization suggestions if your CAPEX exceeds it.')} />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="budget-toggle" className="text-sm text-muted-foreground">
              {t('scenarios.budget.enable', 'Enable')}
            </Label>
            <Switch
              id="budget-toggle"
              checked={isEnabled}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>
      </CardHeader>
      
      {isEnabled && (
        <CardContent className="space-y-4">
          {/* Budget input */}
          <div className="space-y-2">
            <Label htmlFor="max-budget">
              {t('scenarios.budget.maxBudget', 'Maximum Budget')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="max-budget"
                type="text"
                value={maxBudget?.toLocaleString() || ''}
                onChange={handleBudgetValueChange}
                className="pl-7"
                placeholder="2,500,000"
              />
            </div>
          </div>
          
          {/* Budget comparison */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('scenarios.budget.currentCapex', 'Current CAPEX')}
              </span>
              <span className="font-medium">{formatCurrency(currentCapex, region)}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('scenarios.budget.maxBudget', 'Maximum Budget')}
              </span>
              <span className="font-medium">{formatCurrency(maxBudget, region)}</span>
            </div>
            
            {/* Progress bar */}
            <div className="space-y-1">
              <Progress 
                value={Math.min(percentUsed, 100)} 
                className={cn(
                  'h-2',
                  isOverBudget && '[&>div]:bg-destructive'
                )}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {percentUsed.toFixed(0)}% {t('scenarios.budget.used', 'used')}
                </span>
                {isOverBudget ? (
                  <Badge variant="destructive" className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    +{formatCurrency(delta, region)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs flex items-center gap-1 text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('scenarios.budget.withinBudget', 'Within budget')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
