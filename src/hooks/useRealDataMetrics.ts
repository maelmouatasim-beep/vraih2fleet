import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomPricing } from './useCustomPricing';

export interface RealDataMetrics {
  totalRealKm: number;
  realFuelCost: number;
  realCO2: number;
  dataQuality: 'high' | 'mixed' | 'estimates';
  dataQualityPercent: number;
  vehiclesWithRealData: number;
  totalVehicles: number;
  estimatedKm: number;
  estimatedFuelCost: number;
  estimatedCO2: number;
  hasTelematicsData: boolean;
}

const DEFAULT_METRICS: RealDataMetrics = {
  totalRealKm: 0,
  realFuelCost: 0,
  realCO2: 0,
  dataQuality: 'estimates',
  dataQualityPercent: 0,
  vehiclesWithRealData: 0,
  totalVehicles: 0,
  estimatedKm: 0,
  estimatedFuelCost: 0,
  estimatedCO2: 0,
  hasTelematicsData: false,
};

// Constants for estimations
const AVG_ANNUAL_KM = 50000; // Average 50,000 km/year per vehicle
const DIESEL_CONSUMPTION_L_PER_KM = 0.35; // 35L/100km for heavy trucks
const CO2_PER_LITER_DIESEL = 2.68; // kg CO2/L diesel

export function useRealDataMetrics() {
  const { user } = useAuth();
  const { dieselPrice, co2Diesel, isLoading: pricingLoading } = useCustomPricing();
  const [metrics, setMetrics] = useState<RealDataMetrics>(DEFAULT_METRICS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || pricingLoading) {
      setIsLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      try {
        // Fetch telematics vehicles with real data
        const { data: telematicsVehicles, error: telematicsError } = await supabase
          .from('telematics_vehicles')
          .select('annual_km, fuel_consumption, vehicle_type')
          .eq('user_id', user.id);

        if (telematicsError) throw telematicsError;

        // Fetch scenario fleet compositions for estimated data
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', user.id);

        const projectIds = projects?.map(p => p.id) || [];

        let totalEstimatedVehicles = 0;
        let totalEstimatedKm = 0;

        if (projectIds.length > 0) {
          const { data: scenarios } = await supabase
            .from('scenarios')
            .select('fleet_composition')
            .in('project_id', projectIds);

          scenarios?.forEach(s => {
            const fleet = s.fleet_composition as any;
            const vehicleCount = (fleet?.diesel?.count || 0) + 
                                 (fleet?.ev?.count || 0) + 
                                 (fleet?.hydrogen?.count || 0);
            const avgKm = ((fleet?.diesel?.annualKm || 0) + 
                          (fleet?.ev?.annualKm || 0) + 
                          (fleet?.hydrogen?.annualKm || 0)) / 
                          Math.max(1, (fleet?.diesel?.count > 0 ? 1 : 0) + 
                                      (fleet?.ev?.count > 0 ? 1 : 0) + 
                                      (fleet?.hydrogen?.count > 0 ? 1 : 0));
            
            totalEstimatedVehicles += vehicleCount;
            totalEstimatedKm += vehicleCount * (avgKm || AVG_ANNUAL_KM);
          });
        }

        // Calculate real data from telematics
        const vehiclesWithRealData = telematicsVehicles?.length || 0;
        const totalRealKm = telematicsVehicles?.reduce((sum, v) => sum + (v.annual_km || 0), 0) || 0;
        const avgFuelConsumption = telematicsVehicles?.length 
          ? telematicsVehicles.reduce((sum, v) => sum + (v.fuel_consumption || DIESEL_CONSUMPTION_L_PER_KM * 100), 0) / telematicsVehicles.length
          : DIESEL_CONSUMPTION_L_PER_KM * 100;

        // Calculate fuel costs and CO2
        const realFuelCost = (totalRealKm / 100) * avgFuelConsumption * dieselPrice;
        const realCO2 = (totalRealKm / 100) * avgFuelConsumption * co2Diesel / 1000; // tonnes

        // Calculate estimates
        const estimatedKm = Math.max(totalEstimatedKm, (totalEstimatedVehicles || 10) * AVG_ANNUAL_KM);
        const estimatedFuelCost = (estimatedKm / 100) * (DIESEL_CONSUMPTION_L_PER_KM * 100) * dieselPrice;
        const estimatedCO2 = (estimatedKm / 100) * (DIESEL_CONSUMPTION_L_PER_KM * 100) * CO2_PER_LITER_DIESEL / 1000; // tonnes

        // Calculate data quality
        const totalVehicles = Math.max(vehiclesWithRealData, totalEstimatedVehicles);
        const dataQualityPercent = totalVehicles > 0 
          ? Math.round((vehiclesWithRealData / totalVehicles) * 100)
          : 0;

        let dataQuality: 'high' | 'mixed' | 'estimates' = 'estimates';
        if (dataQualityPercent >= 80) dataQuality = 'high';
        else if (dataQualityPercent >= 50) dataQuality = 'mixed';

        setMetrics({
          totalRealKm,
          realFuelCost,
          realCO2,
          dataQuality,
          dataQualityPercent,
          vehiclesWithRealData,
          totalVehicles,
          estimatedKm,
          estimatedFuelCost,
          estimatedCO2,
          hasTelematicsData: vehiclesWithRealData > 0,
        });
      } catch (err) {
        console.error('Error fetching real data metrics:', err);
        setMetrics(DEFAULT_METRICS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [user?.id, dieselPrice, co2Diesel, pricingLoading]);

  return { ...metrics, isLoading };
}
