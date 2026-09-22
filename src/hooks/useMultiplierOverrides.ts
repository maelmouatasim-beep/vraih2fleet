import { useState, useCallback, useMemo } from 'react';
import { 
  MultiplierOverride, 
  MultiplierSource,
  getMultiplierById,
  getEffectiveMultiplierValue,
  SYSTEM_MULTIPLIERS,
  ConfigurableMultiplier,
  MultiplierCategory
} from '@/lib/calculations/configurableMultipliers';

export interface UseMultiplierOverridesReturn {
  /** Current overrides record */
  overrides: Record<string, MultiplierOverride>;
  
  /** Get the effective value for a multiplier (considering overrides) */
  getMultiplier: (id: string) => { value: number; source: MultiplierSource };
  
  /** Set a multiplier to a custom expert value */
  setMultiplier: (id: string, value: number) => void;
  
  /** Reset a multiplier back to system value */
  resetToSystem: (id: string) => void;
  
  /** Reset all overrides */
  resetAll: () => void;
  
  /** Check if a multiplier has been overridden */
  isOverridden: (id: string) => boolean;
  
  /** Get count of overridden multipliers */
  overrideCount: number;
  
  /** Get all overridden multiplier IDs */
  overriddenIds: string[];
  
  /** Bulk set overrides (e.g., when loading from saved scenario) */
  setOverrides: (newOverrides: Record<string, MultiplierOverride>) => void;
  
  /** Get all multipliers for a category with their effective values */
  getMultipliersForCategory: (category: MultiplierCategory) => Array<{
    multiplier: ConfigurableMultiplier;
    effectiveValue: number;
    source: MultiplierSource;
  }>;
}

/**
 * Hook to manage multiplier overrides for TCO calculations
 * Allows experts to either use system values or input their own
 */
export function useMultiplierOverrides(
  initialOverrides?: Record<string, MultiplierOverride>
): UseMultiplierOverridesReturn {
  const [overrides, setOverridesState] = useState<Record<string, MultiplierOverride>>(
    initialOverrides ?? {}
  );

  const getMultiplier = useCallback((id: string) => {
    return getEffectiveMultiplierValue(id, overrides);
  }, [overrides]);

  const setMultiplier = useCallback((id: string, value: number) => {
    const multiplier = getMultiplierById(id);
    if (!multiplier) {
      console.warn(`Unknown multiplier ID: ${id}`);
      return;
    }

    // Clamp value to valid range
    const clampedValue = Math.max(multiplier.minValue, Math.min(multiplier.maxValue, value));

    setOverridesState(prev => ({
      ...prev,
      [id]: {
        value: clampedValue,
        source: 'expert',
      },
    }));
  }, []);

  const resetToSystem = useCallback((id: string) => {
    setOverridesState(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[id];
      return newOverrides;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverridesState({});
  }, []);

  const isOverridden = useCallback((id: string) => {
    return overrides[id]?.source === 'expert';
  }, [overrides]);

  const overrideCount = useMemo(() => {
    return Object.values(overrides).filter(o => o.source === 'expert').length;
  }, [overrides]);

  const overriddenIds = useMemo(() => {
    return Object.entries(overrides)
      .filter(([, o]) => o.source === 'expert')
      .map(([id]) => id);
  }, [overrides]);

  const setOverrides = useCallback((newOverrides: Record<string, MultiplierOverride>) => {
    setOverridesState(newOverrides);
  }, []);

  const getMultipliersForCategory = useCallback((category: MultiplierCategory) => {
    return SYSTEM_MULTIPLIERS
      .filter(m => m.category === category)
      .map(multiplier => {
        const { value, source } = getEffectiveMultiplierValue(multiplier.id, overrides);
        return {
          multiplier,
          effectiveValue: value,
          source,
        };
      });
  }, [overrides]);

  return {
    overrides,
    getMultiplier,
    setMultiplier,
    resetToSystem,
    resetAll,
    isOverridden,
    overrideCount,
    overriddenIds,
    setOverrides,
    getMultipliersForCategory,
  };
}
