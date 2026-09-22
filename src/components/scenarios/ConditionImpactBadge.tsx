import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  ConfigurableMultiplier, 
  formatMultiplierImpact,
  MultiplierSource,
  getMultiplierByCategoryAndKey,
  MultiplierCategory,
} from '@/lib/calculations/configurableMultipliers';
import { Edit3, BookOpen, RotateCcw, Check, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConditionImpactBadgeProps {
  /** Category of the multiplier */
  category: MultiplierCategory;
  /** Key within the category (e.g., '-20' for temperature, 'flat' for terrain) */
  conditionKey: string;
  /** Current effective value */
  currentValue: number;
  /** Source of the current value */
  currentSource: MultiplierSource;
  /** Callback when value changes */
  onChange: (value: number, source: MultiplierSource) => void;
  /** Optional class name */
  className?: string;
}

export function ConditionImpactBadge({
  category,
  conditionKey,
  currentValue,
  currentSource,
  onChange,
  className,
}: ConditionImpactBadgeProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState<string>(currentValue.toString());

  const multiplier = getMultiplierByCategoryAndKey(category, conditionKey);
  
  if (!multiplier) {
    return null;
  }

  const impactDisplay = formatMultiplierImpact(multiplier, currentValue);
  const isExpertValue = currentSource === 'expert';
  
  // Determine impact color based on value
  const getImpactColor = () => {
    if (multiplier.impactType === 'absolute') return 'text-foreground';
    
    const diff = currentValue - 1;
    if (Math.abs(diff) < 0.01) return 'text-muted-foreground';
    
    // For consumption: positive = higher costs, negative = lower costs
    if (multiplier.affectsConsumption) {
      return diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
    }
    
    return 'text-foreground';
  };

  const handleConfirmEdit = () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(multiplier.minValue, Math.min(multiplier.maxValue, numValue));
      onChange(clampedValue, 'expert');
    }
    setIsOpen(false);
  };

  const handleResetToSystem = () => {
    onChange(multiplier.systemValue, 'system');
    setEditValue(multiplier.systemValue.toString());
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setEditValue(currentValue.toString());
    }
    setIsOpen(open);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div 
          className={cn(
            "inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity",
            className
          )}
        >
          {/* Impact value */}
          <span className={cn("text-xs font-medium", getImpactColor())}>
            {impactDisplay}
          </span>
          
          {/* Source badge */}
          {isExpertValue ? (
            <Badge 
              variant="outline" 
              className="h-5 text-[10px] px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
            >
              <Edit3 className="h-2.5 w-2.5 mr-0.5" />
              {t('multipliers.expert', 'Expert')}
            </Badge>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="h-5 text-[10px] px-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                  >
                    <BookOpen className="h-2.5 w-2.5 mr-0.5" />
                    {t('multipliers.system', 'Sys')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{multiplier.sourceReference}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Edit indicator */}
          <Edit3 className="h-3 w-3 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t('multipliers.editImpact', 'Modifier l\'impact')}
            </span>
            {isExpertValue && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={handleResetToSystem}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {t('multipliers.reset', 'Réinitialiser')}
              </Button>
            )}
          </div>
          
          {/* Current impact display */}
          <div className="text-center py-2">
            <span className={cn("text-2xl font-bold", getImpactColor())}>
              {impactDisplay}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {t(multiplier.impactDescriptionKey, multiplier.impactDescriptionKey)}
            </p>
          </div>
          
          {/* Source info */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {isExpertValue ? (
              <span className="flex items-center gap-1">
                <Edit3 className="h-3 w-3" />
                {t('multipliers.expertValue', 'Valeur expert')}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {multiplier.sourceReference}
              </span>
            )}
          </div>
          
          {/* Edit input */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
              min={multiplier.minValue}
              max={multiplier.maxValue}
              step={multiplier.impactType === 'percent' ? 0.01 : 1}
              autoFocus
            />
            <Button
              variant="default"
              size="sm"
              className="h-8 px-3"
              onClick={handleConfirmEdit}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Range hint */}
          <p className="text-[10px] text-muted-foreground text-center">
            {t('multipliers.range', 'Plage')}: {multiplier.minValue} - {multiplier.maxValue}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
