import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Leaf, ChevronDown, RotateCcw } from 'lucide-react';
import { EditableMultiplier } from '@/components/shared/DataProvenance/EditableMultiplier';
import { 
  getMultipliersByCategory, 
  MultiplierOverride,
  MultiplierSource,
  getEffectiveMultiplierValue,
} from '@/lib/calculations/configurableMultipliers';

interface CO2EmissionFactorsSectionProps {
  /** Current overrides for CO2 multipliers */
  overrides: Record<string, MultiplierOverride>;
  /** Callback when a multiplier value changes */
  onChange: (id: string, value: number, source: MultiplierSource) => void;
  /** Callback to reset all CO2 overrides */
  onResetAll?: () => void;
  /** Whether section is initially collapsed */
  defaultCollapsed?: boolean;
}

export function CO2EmissionFactorsSection({
  overrides,
  onChange,
  onResetAll,
  defaultCollapsed = true,
}: CO2EmissionFactorsSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  // Get all CO2 emission multipliers
  const co2Multipliers = getMultipliersByCategory('co2_emissions');

  // Count expert overrides
  const expertCount = co2Multipliers.filter(m => 
    overrides[m.id]?.source === 'expert'
  ).length;

  const handleChange = (multiplierId: string) => (value: number, source: MultiplierSource) => {
    onChange(multiplierId, value, source);
  };

  const handleResetAll = () => {
    onResetAll?.();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-sm">
            {t('multipliers.categories.co2_emissions', 'CO₂ Emission Factors')}
          </span>
          {expertCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {t('multipliers.expertOverrides', '{{count}} expert override(s)', { count: expertCount })}
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3 space-y-3">
        {/* Reset button if any expert values exist */}
        {expertCount > 0 && onResetAll && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={handleResetAll}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {t('multipliers.resetAllToSystem', 'Reset all to system values')}
            </Button>
          </div>
        )}

        {/* Group multipliers by type */}
        <div className="space-y-4">
          {/* Diesel */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('multipliers.co2.dieselSection', 'Diesel')}
            </h5>
            {co2Multipliers
              .filter(m => m.key === 'diesel')
              .map(multiplier => {
                const { value, source } = getEffectiveMultiplierValue(multiplier.id, overrides);
                return (
                  <EditableMultiplier
                    key={multiplier.id}
                    multiplier={multiplier}
                    currentValue={value}
                    currentSource={source}
                    onChange={handleChange(multiplier.id)}
                  />
                );
              })}
          </div>

          {/* Hydrogen */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('multipliers.co2.hydrogenSection', 'Hydrogen')}
            </h5>
            {co2Multipliers
              .filter(m => m.key.startsWith('h2_'))
              .map(multiplier => {
                const { value, source } = getEffectiveMultiplierValue(multiplier.id, overrides);
                return (
                  <EditableMultiplier
                    key={multiplier.id}
                    multiplier={multiplier}
                    currentValue={value}
                    currentSource={source}
                    onChange={handleChange(multiplier.id)}
                  />
                );
              })}
          </div>

          {/* Electricity & Biomethane */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('multipliers.co2.otherSection', 'Electricity & Other')}
            </h5>
            {co2Multipliers
              .filter(m => m.key === 'grid_electricity' || m.key === 'biomethane')
              .map(multiplier => {
                const { value, source } = getEffectiveMultiplierValue(multiplier.id, overrides);
                return (
                  <EditableMultiplier
                    key={multiplier.id}
                    multiplier={multiplier}
                    currentValue={value}
                    currentSource={source}
                    onChange={handleChange(multiplier.id)}
                  />
                );
              })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
