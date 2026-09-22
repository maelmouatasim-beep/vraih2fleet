import { useState, useEffect, useCallback } from 'react';
import { 
  getAllRegionalPricing, 
  getAvailableRegions, 
  normalizeRegion,
  type RegionalPricing 
} from '@/lib/api/referencePricing';

export interface RegionalPricingState {
  diesel: RegionalPricing | null;
  electricity: RegionalPricing | null;
  hydrogen: RegionalPricing | null;
  isLoading: boolean;
  error: string | null;
  region: string;
  availableRegions: string[];
}

export function useRegionalPricing(initialRegion: string = 'QC') {
  const [state, setState] = useState<RegionalPricingState>({
    diesel: null,
    electricity: null,
    hydrogen: null,
    isLoading: true,
    error: null,
    region: normalizeRegion(initialRegion),
    availableRegions: [],
  });

  const loadPricing = useCallback(async (region: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const normalizedRegion = normalizeRegion(region);
      const [pricing, regions] = await Promise.all([
        getAllRegionalPricing(normalizedRegion),
        getAvailableRegions(),
      ]);
      
      setState({
        ...pricing,
        isLoading: false,
        error: null,
        region: normalizedRegion,
        availableRegions: regions,
      });
    } catch (err) {
      console.error('Error loading regional pricing:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load regional pricing',
      }));
    }
  }, []);

  useEffect(() => {
    loadPricing(initialRegion);
  }, [initialRegion, loadPricing]);

  const setRegion = useCallback((newRegion: string) => {
    loadPricing(newRegion);
  }, [loadPricing]);

  const refresh = useCallback(() => {
    loadPricing(state.region);
  }, [loadPricing, state.region]);

  // Helper to get price with fallback
  const getPrice = useCallback((fuelType: 'diesel' | 'electricity' | 'hydrogen'): number => {
    const pricing = state[fuelType];
    if (pricing) {
      return pricing.price_per_unit;
    }
    // Hardcoded fallbacks
    const defaults = { diesel: 1.68, electricity: 0.11, hydrogen: 12.00 };
    return defaults[fuelType];
  }, [state]);

  // Helper to get source info
  const getSource = useCallback((fuelType: 'diesel' | 'electricity' | 'hydrogen'): string | null => {
    return state[fuelType]?.source || null;
  }, [state]);

  return {
    ...state,
    setRegion,
    refresh,
    getPrice,
    getSource,
  };
}

export type { RegionalPricing };
