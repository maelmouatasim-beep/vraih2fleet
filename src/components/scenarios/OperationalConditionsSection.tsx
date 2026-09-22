import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { EditableMultiplier } from '@/components/shared/DataProvenance/EditableMultiplier';
import { 
  ChevronDown, 
  ChevronUp,
  Thermometer,
} from 'lucide-react';
import {
  FlexibleScenarioVehicle,
  MultiplierOverrideValue,
} from '@/lib/calculations/flexibleTypes';
import {
  getMultiplierById,
  MultiplierSource,
} from '@/lib/calculations/configurableMultipliers';

interface OperationalConditionsSectionProps {
  vehicle: Partial<FlexibleScenarioVehicle>;
  index: number;
  onChange: (index: number, updates: Partial<FlexibleScenarioVehicle>) => void;
}

// Map condition selections to multiplier IDs
const TEMP_OPTIONS = [
  { value: '-20', multiplierId: 'temp_-20', label: '-20°C' },
  { value: '-10', multiplierId: 'temp_-10', label: '-10°C' },
  { value: '0', multiplierId: 'temp_0', label: '0°C' },
  { value: '5', multiplierId: 'temp_5', label: 'Optimal (5°C+)' },
];

const TERRAIN_OPTIONS = [
  { value: 'flat', multiplierId: 'terrain_flat', label: 'Flat' },
  { value: 'hilly', multiplierId: 'terrain_hilly', label: 'Hilly' },
  { value: 'mountainous', multiplierId: 'terrain_mountainous', label: 'Mountainous' },
];

const TRIP_OPTIONS = [
  { value: 'urban', multiplierId: 'trip_urban', label: 'Urban' },
  { value: 'periurban', multiplierId: 'trip_periurban', label: 'Periurban' },
  { value: 'long_distance', multiplierId: 'trip_long_distance', label: 'Long distance' },
  { value: 'mixed', multiplierId: 'trip_mixed', label: 'Mixed' },
];

const LOAD_OPTIONS = [
  { value: 'light', multiplierId: 'load_light', label: 'Light' },
  { value: 'medium', multiplierId: 'load_medium', label: 'Medium' },
  { value: 'heavy', multiplierId: 'load_heavy', label: 'Heavy' },
];

export function OperationalConditionsSection({
  vehicle,
  index,
  onChange,
}: OperationalConditionsSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Get current selections from vehicle config or defaults
  const currentTemp = vehicle.operationalConditions?.temperature ?? '-10';
  const currentTerrain = vehicle.operationalConditions?.terrain ?? 'flat';
  const currentTrip = vehicle.operationalConditions?.tripType ?? 'mixed';
  const currentLoad = vehicle.operationalConditions?.loadProfile ?? 'medium';

  // Get current overrides
  const overrides = vehicle.multiplierOverrides ?? {};

  const handleConditionChange = (field: 'temperature' | 'terrain' | 'tripType' | 'loadProfile', value: string) => {
    const currentConditions = vehicle.operationalConditions ?? {};
    onChange(index, {
      operationalConditions: {
        ...currentConditions,
        [field]: value,
      },
    });
  };

  const handleMultiplierChange = (multiplierId: string, value: number, source: MultiplierSource) => {
    const newOverrides = { ...overrides };
    
    if (source === 'system') {
      // Remove override to use system value
      delete newOverrides[multiplierId];
    } else {
      newOverrides[multiplierId] = { value, source: 'expert' };
    }
    
    onChange(index, { multiplierOverrides: newOverrides });
  };

  const getEffectiveValue = (multiplierId: string): { value: number; source: MultiplierSource } => {
    const override = overrides[multiplierId];
    if (override?.source === 'expert') {
      return { value: override.value, source: 'expert' };
    }
    const multiplier = getMultiplierById(multiplierId);
    return { value: multiplier?.systemValue ?? 1.0, source: 'system' };
  };

  const renderConditionRow = (
    label: string,
    options: { value: string; multiplierId: string; label: string }[],
    currentValue: string,
    field: 'temperature' | 'terrain' | 'tripType' | 'loadProfile'
  ) => {
    const currentOption = options.find(o => o.value === currentValue);
    const multiplierId = currentOption?.multiplierId || options[0].multiplierId;
    const multiplier = getMultiplierById(multiplierId);
    const effective = getEffectiveValue(multiplierId);

    if (!multiplier) return null;

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        
        <div className="space-y-2">
          <Select
            value={currentValue}
            onValueChange={(v) => handleConditionChange(field, v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(`multipliers.options.${opt.value}`, opt.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <EditableMultiplier
            multiplier={multiplier}
            currentSource={effective.source}
            currentValue={effective.value}
            onChange={(value, source) => handleMultiplierChange(multiplierId, value, source)}
            compact
          />
        </div>
      </div>
    );
  };

  // Count active overrides
  const activeOverrides = Object.values(overrides).filter(o => o.source === 'expert').length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium">
              {t('flexibleScenario.operationalConditions', 'Operational conditions')}
            </span>
            {activeOverrides > 0 && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                {activeOverrides} {t('multipliers.expertValues', 'expert values')}
              </span>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="p-4 bg-muted/30 rounded-b-lg -mt-2 pt-4 space-y-4">
        <p className="text-xs text-muted-foreground mb-4">
          {t('multipliers.conditionsDescription', 'These factors adjust energy consumption based on your real operating conditions. You can use our reference values or enter your own data.')}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderConditionRow(
            t('multipliers.categories.temperature', 'Minimum temperature'),
            TEMP_OPTIONS,
            currentTemp,
            'temperature'
          )}
          
          {renderConditionRow(
            t('multipliers.categories.terrain', 'Terrain type'),
            TERRAIN_OPTIONS,
            currentTerrain,
            'terrain'
          )}
          
          {renderConditionRow(
            t('multipliers.categories.trip', 'Trip type'),
            TRIP_OPTIONS,
            currentTrip,
            'tripType'
          )}
          
          {renderConditionRow(
            t('multipliers.categories.load', 'Load profile'),
            LOAD_OPTIONS,
            currentLoad,
            'loadProfile'
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
