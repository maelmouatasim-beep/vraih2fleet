import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Building2, Zap, Fuel, Edit3 } from 'lucide-react';
import { EditableMultiplier } from '@/components/shared/DataProvenance/EditableMultiplier';
import {
  getMultipliersByCategory,
  getEffectiveMultiplierValue,
  MultiplierOverride,
} from '@/lib/calculations/configurableMultipliers';

interface InfrastructureCostsSectionProps {
  multiplierOverrides: Record<string, MultiplierOverride>;
  onMultiplierChange: (id: string, value: number) => void;
  onMultiplierReset: (id: string) => void;
}

export function InfrastructureCostsSection({
  multiplierOverrides,
  onMultiplierChange,
  onMultiplierReset,
}: InfrastructureCostsSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Get infrastructure multipliers
  const infraMultipliers = getMultipliersByCategory('infrastructure');

  // Split into EV and H2 groups
  const evMultipliers = infraMultipliers.filter(m => 
    m.key.includes('slow') || m.key.includes('fast') || m.key.includes('ultra') || m.key.includes('ev_')
  );
  const h2Multipliers = infraMultipliers.filter(m => 
    m.key.includes('h2_') || m.key.includes('hydrogen')
  );
  const otherMultipliers = infraMultipliers.filter(m => 
    !evMultipliers.includes(m) && !h2Multipliers.includes(m)
  );

  // Count expert overrides
  const expertCount = Object.values(multiplierOverrides).filter(o => o.source === 'expert').length;
  const infraExpertCount = infraMultipliers.filter(m => 
    multiplierOverrides[m.id]?.source === 'expert'
  ).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-indigo-500" />
          <div className="text-left">
            <h4 className="text-sm font-medium flex items-center gap-2">
              {t('multipliers.infrastructure.title', 'Infrastructure Costs')}
              {infraExpertCount > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  <Edit3 className="h-3 w-3 mr-1" />
                  {infraExpertCount} {t('multipliers.overrides', 'override(s)')}
                </Badge>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t('multipliers.infrastructure.description', 'EV chargers and H₂ station CAPEX/OPEX costs')}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t">
        <div className="p-4 space-y-6">
          {/* EV Infrastructure */}
          {evMultipliers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <Zap className="h-4 w-4" />
                {t('multipliers.infrastructure.evChargers', 'EV Charging Infrastructure')}
              </div>
              <div className="space-y-2 pl-4 border-l-2 border-green-200 dark:border-green-800">
                {evMultipliers.map(multiplier => {
                  const { value, source } = getEffectiveMultiplierValue(multiplier.id, multiplierOverrides);
                  return (
                    <EditableMultiplier
                      key={multiplier.id}
                      multiplier={multiplier}
                      currentValue={value}
                      currentSource={source}
                      onChange={(newValue, newSource) => {
                        if (newSource === 'expert') {
                          onMultiplierChange(multiplier.id, newValue);
                        } else {
                          onMultiplierReset(multiplier.id);
                        }
                      }}
                      compact
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* H2 Infrastructure */}
          {h2Multipliers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                <Fuel className="h-4 w-4" />
                {t('multipliers.infrastructure.h2Stations', 'H₂ Station Infrastructure')}
              </div>
              <div className="space-y-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                {h2Multipliers.map(multiplier => {
                  const { value, source } = getEffectiveMultiplierValue(multiplier.id, multiplierOverrides);
                  return (
                    <EditableMultiplier
                      key={multiplier.id}
                      multiplier={multiplier}
                      currentValue={value}
                      currentSource={source}
                      onChange={(newValue, newSource) => {
                        if (newSource === 'expert') {
                          onMultiplierChange(multiplier.id, newValue);
                        } else {
                          onMultiplierReset(multiplier.id);
                        }
                      }}
                      compact
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Other Infrastructure Costs */}
          {otherMultipliers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {t('multipliers.infrastructure.other', 'Other Infrastructure')}
              </div>
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                {otherMultipliers.map(multiplier => {
                  const { value, source } = getEffectiveMultiplierValue(multiplier.id, multiplierOverrides);
                  return (
                    <EditableMultiplier
                      key={multiplier.id}
                      multiplier={multiplier}
                      currentValue={value}
                      currentSource={source}
                      onChange={(newValue, newSource) => {
                        if (newSource === 'expert') {
                          onMultiplierChange(multiplier.id, newValue);
                        } else {
                          onMultiplierReset(multiplier.id);
                        }
                      }}
                      compact
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
