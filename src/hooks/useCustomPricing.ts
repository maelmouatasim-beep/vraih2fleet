import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CustomPricing {
  electricityPrice: number;  // $/kWh
  h2Price: number;           // $/kg
  dieselPrice: number;       // $/L
  co2Electricity: number;    // kg CO2/kWh
  co2H2: number;             // kg CO2/kg
  co2Diesel: number;         // kg CO2/L
  isCustom: boolean;
  lastUpdated: Date | null;
}

// Default Canadian market averages
const DEFAULT_PRICING: CustomPricing = {
  electricityPrice: 0.12,   // $0.12/kWh (Canada avg)
  h2Price: 12.00,           // $12/kg (current market)
  dieselPrice: 1.85,        // $1.85/L (Canada avg)
  co2Electricity: 0.04,     // 40g CO2/kWh (Canada grid avg)
  co2H2: 9.0,               // 9kg CO2/kg (grey H2) - can be 0 for green
  co2Diesel: 2.68,          // 2.68kg CO2/L
  isCustom: false,
  lastUpdated: null,
};

export function useCustomPricing() {
  const { user } = useAuth();
  const [pricing, setPricing] = useState<CustomPricing>(DEFAULT_PRICING);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomPricing = useCallback(async () => {
    if (!user?.id) {
      setPricing(DEFAULT_PRICING);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('custom_reference_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', 'pricing')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.data) {
        const customData = data.data as Record<string, any>;
        setPricing({
          electricityPrice: customData.electricityPrice ?? DEFAULT_PRICING.electricityPrice,
          h2Price: customData.h2Price ?? DEFAULT_PRICING.h2Price,
          dieselPrice: customData.dieselPrice ?? DEFAULT_PRICING.dieselPrice,
          co2Electricity: customData.co2Electricity ?? DEFAULT_PRICING.co2Electricity,
          co2H2: customData.co2H2 ?? DEFAULT_PRICING.co2H2,
          co2Diesel: customData.co2Diesel ?? DEFAULT_PRICING.co2Diesel,
          isCustom: true,
          lastUpdated: new Date(data.updated_at),
        });
      } else {
        setPricing(DEFAULT_PRICING);
      }
    } catch (err) {
      console.error('Error fetching custom pricing:', err);
      setPricing(DEFAULT_PRICING);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCustomPricing();
  }, [fetchCustomPricing]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('custom_pricing_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_reference_data',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if ((payload.new as any)?.category === 'pricing') {
            fetchCustomPricing();
            toast.success('Pricing updated - all calculations refreshed');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchCustomPricing]);

  const updatePricing = async (newPricing: Partial<CustomPricing>) => {
    if (!user?.id) return false;

    const updatedPricing = {
      electricityPrice: newPricing.electricityPrice ?? pricing.electricityPrice,
      h2Price: newPricing.h2Price ?? pricing.h2Price,
      dieselPrice: newPricing.dieselPrice ?? pricing.dieselPrice,
      co2Electricity: newPricing.co2Electricity ?? pricing.co2Electricity,
      co2H2: newPricing.co2H2 ?? pricing.co2H2,
      co2Diesel: newPricing.co2Diesel ?? pricing.co2Diesel,
    };

    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('custom_reference_data')
        .select('id')
        .eq('user_id', user.id)
        .eq('category', 'pricing')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('custom_reference_data')
          .update({
            data: updatedPricing,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_reference_data')
          .insert({
            user_id: user.id,
            name: 'Custom Pricing',
            category: 'pricing',
            data: updatedPricing,
          });

        if (error) throw error;
      }

      setPricing({
        ...updatedPricing,
        isCustom: true,
        lastUpdated: new Date(),
      });

      return true;
    } catch (err) {
      console.error('Error updating custom pricing:', err);
      return false;
    }
  };

  const resetToDefaults = async () => {
    if (!user?.id) return false;

    try {
      await supabase
        .from('custom_reference_data')
        .delete()
        .eq('user_id', user.id)
        .eq('category', 'pricing');

      setPricing(DEFAULT_PRICING);
      return true;
    } catch (err) {
      console.error('Error resetting pricing:', err);
      return false;
    }
  };

  return {
    ...pricing,
    isLoading,
    updatePricing,
    resetToDefaults,
    refresh: fetchCustomPricing,
    defaults: DEFAULT_PRICING,
  };
}
