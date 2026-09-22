import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Edit3, BookOpen, Settings2 } from 'lucide-react';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  MultiplierOverride, 
  getMultiplierById, 
  formatMultiplierImpact,
  getCategoryLabelKey,
  MultiplierCategory,
} from '@/lib/calculations/configurableMultipliers';

interface MultiplierSummaryCardProps {
  /** Map of multiplier ID to override values used in calculation */
  appliedMultipliers?: Record<string, MultiplierOverride>;
  /** Title override */
  title?: string;
}

interface GroupedMultiplier {
  id: string;
  name: string;
  impact: string;
  source: 'system' | 'expert';
  sourceReference?: string;
  category: MultiplierCategory;
}

export function MultiplierSummaryCard({
  appliedMultipliers,
  title,
}: MultiplierSummaryCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Early return if no multipliers
  if (!appliedMultipliers || Object.keys(appliedMultipliers).length === 0) {
    return null;
  }

  // Process multipliers into grouped display
  const processedMultipliers: GroupedMultiplier[] = [];
  const categoryGroups: Record<MultiplierCategory, GroupedMultiplier[]> = {
    temperature: [],
    terrain: [],
    trip_type: [],
    load: [],
    ptac: [],
    co2_emissions: [],
    infrastructure: [],
    consumption: [],
  };

  Object.entries(appliedMultipliers).forEach(([id, override]) => {
    const multiplier = getMultiplierById(id);
    if (!multiplier) return;

    const processed: GroupedMultiplier = {
      id,
      name: t(multiplier.impactDescriptionKey, multiplier.key),
      impact: formatMultiplierImpact(multiplier, override.value),
      source: override.source,
      sourceReference: multiplier.sourceReference,
      category: multiplier.category,
    };

    processedMultipliers.push(processed);
    categoryGroups[multiplier.category].push(processed);
  });

  // Count expert values
  const expertCount = processedMultipliers.filter(m => m.source === 'expert').length;
  const systemCount = processedMultipliers.length - expertCount;

  // Filter to only show categories with entries
  const activeCategories = (Object.entries(categoryGroups) as [MultiplierCategory, GroupedMultiplier[]][])
    .filter(([, items]) => items.length > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-violet-500" />
          <span className="font-medium text-sm">
            {title || t('scenarios.params.multipliersUsed', 'Calculation Multipliers')}
          </span>
          <div className="flex items-center gap-1">
            {systemCount > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                <BookOpen className="h-3 w-3 mr-1" />
                {systemCount} {t('multipliers.systemShort', 'system')}
              </Badge>
            )}
            {expertCount > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                <Edit3 className="h-3 w-3 mr-1" />
                {expertCount} {t('multipliers.expertShort', 'expert')}
              </Badge>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3">
        <div className="space-y-4 pl-2 border-l-2 border-violet-200 dark:border-violet-800">
          {activeCategories.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-2">
                {t(getCategoryLabelKey(category), category)}
              </h5>
              <div className="space-y-1">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.name}</span>
                      <span className="text-sm font-semibold">{item.impact}</span>
                    </div>
                    {item.source === 'expert' ? (
                      <Badge 
                        variant="outline" 
                        className="text-xs h-5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                      >
                        <Edit3 className="h-2.5 w-2.5 mr-1" />
                        {t('multipliers.expertShort', 'expert')}
                      </Badge>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className="text-xs h-5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 cursor-help"
                            >
                              <BookOpen className="h-2.5 w-2.5 mr-1" />
                              {t('multipliers.systemShort', 'system')}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{item.sourceReference}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
