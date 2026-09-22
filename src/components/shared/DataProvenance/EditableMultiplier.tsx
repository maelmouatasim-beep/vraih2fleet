import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  ConfigurableMultiplier, 
  formatMultiplierImpact,
  MultiplierSource 
} from '@/lib/calculations/configurableMultipliers';
import { Edit3, BookOpen, RotateCcw, Check, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EditableMultiplierProps {
  /** The multiplier configuration */
  multiplier: ConfigurableMultiplier;
  /** Current effective value */
  currentValue: number;
  /** Source of the current value */
  currentSource: MultiplierSource;
  /** Callback when value changes */
  onChange: (value: number, source: MultiplierSource) => void;
  /** Optional class name */
  className?: string;
  /** Compact display mode */
  compact?: boolean;
}

export function EditableMultiplier({
  multiplier,
  currentValue,
  currentSource,
  onChange,
  className,
  compact = false,
}: EditableMultiplierProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(currentValue.toString());

  const impactDisplay = formatMultiplierImpact(multiplier, currentValue);
  const isExpertValue = currentSource === 'expert';
  
  // Determine impact color based on value
  const getImpactColor = () => {
    if (multiplier.impactType === 'absolute') return 'text-foreground';
    
    const diff = currentValue - 1;
    if (Math.abs(diff) < 0.01) return 'text-muted-foreground';
    
    // For consumption: positive = bad (higher costs), negative = good
    if (multiplier.affectsConsumption) {
      return diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
    }
    
    return 'text-foreground';
  };

  const handleStartEdit = () => {
    setEditValue(currentValue.toString());
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      // Clamp to valid range
      const clampedValue = Math.max(multiplier.minValue, Math.min(multiplier.maxValue, numValue));
      onChange(clampedValue, 'expert');
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(currentValue.toString());
    setIsEditing(false);
  };

  const handleResetToSystem = () => {
    onChange(multiplier.systemValue, 'system');
    setEditValue(multiplier.systemValue.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center justify-between gap-2", className)}>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", getImpactColor())}>
            {impactDisplay}
          </span>
          {isExpertValue ? (
            <Badge variant="outline" className="h-5 text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
              <Edit3 className="h-3 w-3 mr-1" />
              {t('multipliers.expertValue', 'Expert')}
            </Badge>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-5 text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                    <BookOpen className="h-3 w-3 mr-1" />
                    {t('multipliers.systemSource', 'System')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{multiplier.sourceReference}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleStartEdit}
        >
          <Edit3 className="h-3 w-3 mr-1" />
          {t('common.edit', 'Edit')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      isExpertValue ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" : "border-border bg-card",
      className
    )}>
      {/* Header with impact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-lg font-semibold", getImpactColor())}>
            {impactDisplay}
          </span>
          {multiplier.impactType === 'absolute' && (
            <span className="text-sm text-muted-foreground">{multiplier.unit}</span>
          )}
        </div>
        
        {/* Source badge */}
        {isExpertValue ? (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
            <Edit3 className="h-3 w-3 mr-1" />
            {t('multipliers.expertValue', 'Expert value')}
          </Badge>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {t('multipliers.systemSource', 'System source')}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">{multiplier.sourceReference}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">
        {t(multiplier.impactDescriptionKey, multiplier.impactDescriptionKey)}
      </p>

      {/* Edit controls */}
      <div className="flex items-center justify-between pt-1">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-24 text-sm"
              min={multiplier.minValue}
              max={multiplier.maxValue}
              step={multiplier.impactType === 'percent' ? 0.01 : 1}
              autoFocus
            />
            <span className="text-xs text-muted-foreground">
              ({multiplier.minValue} - {multiplier.maxValue})
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleConfirmEdit}
            >
              <Check className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleCancelEdit}
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleStartEdit}
            >
              <Edit3 className="h-3 w-3 mr-1" />
              {t('multipliers.edit', 'Edit')}
            </Button>
            {isExpertValue && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleResetToSystem}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {t('multipliers.useSystemValue', 'Use system value')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
