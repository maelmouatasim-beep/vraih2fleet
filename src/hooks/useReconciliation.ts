import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TelematicsVehicle {
  id: string;
  vehicle_type: string;
  annual_km: number;
  fuel_consumption: number; // L/100km
  route_type: string;
}

interface ScenarioFleetItem {
  count: number;
  annualKm: number;
  consumption?: number;
}

interface ScenarioFleetComposition {
  diesel?: ScenarioFleetItem;
  ev?: ScenarioFleetItem;
  hydrogen?: ScenarioFleetItem;
}

interface TcoResult {
  scenario_id: string;
  opex_total: number;
  baseline_tco: number;
  applied_diesel_price: number;
}

interface ReconciliationItem {
  vehicleType: string;
  vehicleCount: number;
  realAnnualKm: number;
  predictedAnnualKm: number;
  realConsumption: number; // L/100km
  predictedConsumption: number; // L/100km
  kmDeviation: number; // percentage
  consumptionDeviation: number; // percentage
  deviationStatus: 'good' | 'warning' | 'alert';
}

interface ReconciliationData {
  items: ReconciliationItem[];
  hasData: boolean;
  hasSignificantDeviation: boolean;
  overallKmDeviation: number;
  overallConsumptionDeviation: number;
  alerts: ReconciliationAlert[];
}

interface ReconciliationAlert {
  type: 'km' | 'consumption';
  vehicleType: string;
  deviation: number;
  message: string;
}

const DEFAULT_CONSUMPTION: Record<string, number> = {
  'Light Van': 15,
  'Medium Truck': 25,
  'Heavy Truck': 35,
  'default': 25,
};

export function useReconciliation(projectId?: string) {
  const { user } = useAuth();
  const [telematicsVehicles, setTelematicsVehicles] = useState<TelematicsVehicle[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [tcoResults, setTcoResults] = useState<TcoResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      try {
        // Fetch telematics vehicles
        const { data: vehicles } = await supabase
          .from('telematics_vehicles')
          .select('id, vehicle_type, annual_km, fuel_consumption, route_type')
          .eq('user_id', user.id);
        
        setTelematicsVehicles(vehicles || []);

        // Fetch scenarios and TCO results if project specified
        if (projectId) {
          const { data: scenarioData } = await supabase
            .from('scenarios')
            .select('id, name, fleet_composition')
            .eq('project_id', projectId);
          
          setScenarios(scenarioData || []);

          if (scenarioData && scenarioData.length > 0) {
            const scenarioIds = scenarioData.map(s => s.id);
            const { data: tcoData } = await supabase
              .from('tco_results')
              .select('scenario_id, opex_total, baseline_tco, applied_diesel_price')
              .in('scenario_id', scenarioIds)
              .eq('is_current', true);
            
            setTcoResults(tcoData || []);
          }
        }
      } catch (error) {
        console.error('Error fetching reconciliation data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, projectId]);

  const reconciliationData = useMemo((): ReconciliationData => {
    if (telematicsVehicles.length === 0) {
      return {
        items: [],
        hasData: false,
        hasSignificantDeviation: false,
        overallKmDeviation: 0,
        overallConsumptionDeviation: 0,
        alerts: [],
      };
    }

    // Group telematics vehicles by type
    const telematicsByType = telematicsVehicles.reduce((acc, v) => {
      const type = v.vehicle_type;
      if (!acc[type]) {
        acc[type] = { count: 0, totalKm: 0, totalConsumption: 0 };
      }
      acc[type].count++;
      acc[type].totalKm += v.annual_km;
      acc[type].totalConsumption += v.fuel_consumption;
      return acc;
    }, {} as Record<string, { count: number; totalKm: number; totalConsumption: number }>);

    // Get predictions from scenarios (using first scenario with TCO results)
    let predictedByType: Record<string, { count: number; annualKm: number; consumption: number }> = {};
    
    if (scenarios.length > 0) {
      const scenarioWithTco = scenarios.find(s => 
        tcoResults.some(t => t.scenario_id === s.id)
      ) || scenarios[0];
      
      const fleet = scenarioWithTco.fleet_composition as ScenarioFleetComposition;
      
      // Map scenario fleet to vehicle types
      if (fleet.diesel && fleet.diesel.count > 0) {
        // Distribute diesel across vehicle types based on telematics distribution
        const totalTelematics = Object.values(telematicsByType).reduce((sum, t) => sum + t.count, 0);
        
        Object.entries(telematicsByType).forEach(([type, data]) => {
          const ratio = data.count / totalTelematics;
          const allocatedCount = Math.round(fleet.diesel!.count * ratio);
          
          predictedByType[type] = {
            count: allocatedCount,
            annualKm: fleet.diesel!.annualKm || 40000,
            consumption: fleet.diesel!.consumption || DEFAULT_CONSUMPTION[type] || DEFAULT_CONSUMPTION.default,
          };
        });
      }
    }

    // Calculate reconciliation items
    const items: ReconciliationItem[] = Object.entries(telematicsByType).map(([type, realData]) => {
      const predicted = predictedByType[type] || {
        count: realData.count,
        annualKm: 40000,
        consumption: DEFAULT_CONSUMPTION[type] || DEFAULT_CONSUMPTION.default,
      };

      const realAvgKm = realData.totalKm / realData.count;
      const realAvgConsumption = realData.totalConsumption / realData.count;
      
      const kmDeviation = predicted.annualKm > 0 
        ? ((realAvgKm - predicted.annualKm) / predicted.annualKm) * 100 
        : 0;
      
      const consumptionDeviation = predicted.consumption > 0
        ? ((realAvgConsumption - predicted.consumption) / predicted.consumption) * 100
        : 0;

      const maxDeviation = Math.max(Math.abs(kmDeviation), Math.abs(consumptionDeviation));
      let deviationStatus: 'good' | 'warning' | 'alert' = 'good';
      if (maxDeviation > 15) deviationStatus = 'alert';
      else if (maxDeviation > 5) deviationStatus = 'warning';

      return {
        vehicleType: type,
        vehicleCount: realData.count,
        realAnnualKm: Math.round(realAvgKm),
        predictedAnnualKm: Math.round(predicted.annualKm),
        realConsumption: Math.round(realAvgConsumption * 10) / 10,
        predictedConsumption: Math.round(predicted.consumption * 10) / 10,
        kmDeviation: Math.round(kmDeviation * 10) / 10,
        consumptionDeviation: Math.round(consumptionDeviation * 10) / 10,
        deviationStatus,
      };
    });

    // Calculate overall deviations
    const totalVehicles = items.reduce((sum, i) => sum + i.vehicleCount, 0);
    const overallKmDeviation = totalVehicles > 0
      ? items.reduce((sum, i) => sum + i.kmDeviation * i.vehicleCount, 0) / totalVehicles
      : 0;
    const overallConsumptionDeviation = totalVehicles > 0
      ? items.reduce((sum, i) => sum + i.consumptionDeviation * i.vehicleCount, 0) / totalVehicles
      : 0;

    // Generate alerts
    const alerts: ReconciliationAlert[] = [];
    items.forEach(item => {
      if (Math.abs(item.kmDeviation) > 15) {
        alerts.push({
          type: 'km',
          vehicleType: item.vehicleType,
          deviation: item.kmDeviation,
          message: `${item.vehicleType}: ${item.kmDeviation > 0 ? '+' : ''}${item.kmDeviation}% km/an vs prédictions`,
        });
      }
      if (Math.abs(item.consumptionDeviation) > 15) {
        alerts.push({
          type: 'consumption',
          vehicleType: item.vehicleType,
          deviation: item.consumptionDeviation,
          message: `${item.vehicleType}: ${item.consumptionDeviation > 0 ? '+' : ''}${item.consumptionDeviation}% consommation vs prédictions`,
        });
      }
    });

    return {
      items,
      hasData: true,
      hasSignificantDeviation: alerts.length > 0,
      overallKmDeviation: Math.round(overallKmDeviation * 10) / 10,
      overallConsumptionDeviation: Math.round(overallConsumptionDeviation * 10) / 10,
      alerts,
    };
  }, [telematicsVehicles, scenarios, tcoResults]);

  return {
    ...reconciliationData,
    isLoading,
    telematicsVehicleCount: telematicsVehicles.length,
  };
}
