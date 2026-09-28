import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TelematicsVehicleData {
  id: string;
  external_id: string;
  vehicle_type: string;
  make_model: string;
  annual_km: number;
  fuel_consumption: number;
  route_type: string;
  latitude?: number;
  longitude?: number;
}

export interface GeographicZone {
  id: string;
  name: string;
  centroid: { lat: number; lng: number };
  vehicleCount: number;
  totalDailyKm: number;
  avgDailyKm: number;
  priority: 'high' | 'medium' | 'low';
  needsCharging: boolean;
  needsH2: boolean;
}

export interface InfrastructureRecommendation {
  type: 'ev_charger' | 'h2_station';
  location: { lat: number; lng: number };
  reason: string;
  priority: number;
  estimatedDemand: number;
  vehiclesServed: number;
}

export interface FeasibilityAlert {
  id: string;
  type: 'capacity' | 'coverage' | 'queue' | 'grid';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
}

export interface UsageSimulation {
  hour: number;
  evQueueLength: number;
  h2QueueLength: number;
  evWaitTime: number;
  h2WaitTime: number;
  evUtilization: number;
  h2Utilization: number;
}

export interface GridAnalysis {
  totalPowerNeeded: number;
  peakDemandKw: number;
  offPeakPotential: number;
  renewableIntegration: number;
  v2gPotential: number;
  upgradeRequired: boolean;
  estimatedUpgradeCost: number;
}

// Canadian provinces with mock coordinates for demo
const PROVINCE_CENTERS: Record<string, { lat: number; lng: number }> = {
  'BC': { lat: 53.7267, lng: -127.6476 },
  'AB': { lat: 53.9333, lng: -116.5765 },
  'SK': { lat: 52.9399, lng: -106.4509 },
  'MB': { lat: 53.7609, lng: -98.8139 },
  'ON': { lat: 51.2538, lng: -85.3232 },
  'QC': { lat: 52.9399, lng: -73.5491 },
  'NB': { lat: 46.5653, lng: -66.4619 },
  'NS': { lat: 44.6820, lng: -63.7443 },
  'PE': { lat: 46.5107, lng: -63.4168 },
  'NL': { lat: 53.1355, lng: -57.6604 },
};

export function useInfrastructureTelematics() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<TelematicsVehicleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTelematicsData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('telematics_vehicles')
          .select('*')
          .eq('user_id', user.id);

        if (fetchError) throw fetchError;

        // Ces véhicules n'ont PAS de position GPS : on les répartit sur
        // une grille DÉTERMINISTE autour du centre de leur province pour
        // l'affichage (Phase 2c : plus d'aléatoire déguisé en donnée).
        const vehiclesWithLocation = (data || []).map((v, index) => {
          const provinces = Object.keys(PROVINCE_CENTERS);
          const province = provinces[index % provinces.length];
          const center = PROVINCE_CENTERS[province];

          const rang = Math.floor(index / provinces.length);
          const lat = center.lat + ((rang % 5) - 2) * 0.8;
          const lng = center.lng + ((Math.floor(rang / 5) % 7) - 3) * 0.9;

          return {
            ...v,
            latitude: lat,
            longitude: lng,
          };
        });

        setVehicles(vehiclesWithLocation);
      } catch (err) {
        console.error('Error fetching telematics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTelematicsData();
  }, [user?.id]);

  // Calculate geographic zones based on vehicle clusters
  const geographicZones = useMemo((): GeographicZone[] => {
    if (vehicles.length === 0) return [];

    // Group vehicles by approximate region (simplified clustering)
    const zones: Map<string, TelematicsVehicleData[]> = new Map();
    
    vehicles.forEach(v => {
      if (v.latitude && v.longitude) {
        // Create zone key based on rounded coordinates
        const zoneKey = `${Math.round(v.latitude)}_${Math.round(v.longitude)}`;
        if (!zones.has(zoneKey)) {
          zones.set(zoneKey, []);
        }
        zones.get(zoneKey)!.push(v);
      }
    });

    return Array.from(zones.entries()).map(([key, zoneVehicles], index) => {
      const avgLat = zoneVehicles.reduce((sum, v) => sum + (v.latitude || 0), 0) / zoneVehicles.length;
      const avgLng = zoneVehicles.reduce((sum, v) => sum + (v.longitude || 0), 0) / zoneVehicles.length;
      const totalDailyKm = zoneVehicles.reduce((sum, v) => sum + (v.annual_km / 365), 0);
      const avgDailyKm = totalDailyKm / zoneVehicles.length;
      
      const shortRange = zoneVehicles.filter(v => (v.annual_km / 365) < 100).length;
      const longRange = zoneVehicles.filter(v => (v.annual_km / 365) > 300).length;

      return {
        id: `zone-${index}`,
        name: `Zone ${index + 1}`,
        centroid: { lat: avgLat, lng: avgLng },
        vehicleCount: zoneVehicles.length,
        totalDailyKm: Math.round(totalDailyKm),
        avgDailyKm: Math.round(avgDailyKm),
        priority: zoneVehicles.length > 10 ? 'high' : zoneVehicles.length > 5 ? 'medium' : 'low',
        needsCharging: shortRange > 0,
        needsH2: longRange > 0,
      };
    });
  }, [vehicles]);

  // Generate infrastructure recommendations
  const recommendations = useMemo((): InfrastructureRecommendation[] => {
    return geographicZones
      .filter(z => z.priority !== 'low')
      .flatMap(zone => {
        const recs: InfrastructureRecommendation[] = [];
        
        if (zone.needsCharging) {
          recs.push({
            type: 'ev_charger',
            location: zone.centroid,
            reason: `${zone.vehicleCount} véhicules courte distance dans cette zone`,
            priority: zone.priority === 'high' ? 1 : 2,
            estimatedDemand: zone.totalDailyKm * 0.25, // kWh
            vehiclesServed: zone.vehicleCount,
          });
        }
        
        if (zone.needsH2) {
          recs.push({
            type: 'h2_station',
            location: zone.centroid,
            reason: `${zone.vehicleCount} véhicules longue distance dans cette zone`,
            priority: zone.priority === 'high' ? 1 : 2,
            estimatedDemand: zone.totalDailyKm * 0.08, // kg H2
            vehiclesServed: zone.vehicleCount,
          });
        }
        
        return recs;
      })
      .sort((a, b) => a.priority - b.priority);
  }, [geographicZones]);

  // Generate feasibility alerts
  const alerts = useMemo((): FeasibilityAlert[] => {
    const alertList: FeasibilityAlert[] = [];
    
    const totalVehicles = vehicles.length;
    const totalDailyKm = vehicles.reduce((sum, v) => sum + (v.annual_km / 365), 0);
    
    // Check coverage
    const zonesWithInfra = geographicZones.filter(z => z.priority === 'high');
    if (zonesWithInfra.length === 0 && totalVehicles > 0) {
      alertList.push({
        id: 'coverage-1',
        type: 'coverage',
        severity: 'critical',
        title: 'Aucune zone prioritaire identifiée',
        description: 'Les données télématiques ne montrent pas de zones de concentration suffisante.',
        recommendation: 'Importez plus de données de véhicules ou ajustez les paramètres de clustering.',
      });
    }

    // Check capacity
    if (totalDailyKm > 50000) {
      alertList.push({
        id: 'capacity-1',
        type: 'capacity',
        severity: 'warning',
        title: 'Forte demande quotidienne détectée',
        description: `${Math.round(totalDailyKm).toLocaleString()} km/jour nécessitent une infrastructure conséquente.`,
        recommendation: 'Planifiez au moins 2 stations H₂ et 10 bornes de recharge.',
      });
    }

    // Check grid
    const estimatedPowerNeed = totalDailyKm * 0.25 / 8; // kW average
    if (estimatedPowerNeed > 500) {
      alertList.push({
        id: 'grid-1',
        type: 'grid',
        severity: 'warning',
        title: 'Mise à niveau réseau nécessaire',
        description: `Puissance estimée: ${Math.round(estimatedPowerNeed)} kW dépasse la capacité standard.`,
        recommendation: 'Contactez votre distributeur électrique pour évaluer les options.',
      });
    }

    return alertList;
  }, [vehicles, geographicZones]);

  // Simulate daily usage patterns - only if we have real vehicles
  const usageSimulation = useMemo((): UsageSimulation[] => {
    // Return empty array if no real vehicle data
    if (vehicles.length === 0) return [];
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const totalVehicles = vehicles.length;
    
    return hours.map(hour => {
      // Morning peak: 6-9, Evening: 16-19
      const isMorningPeak = hour >= 6 && hour <= 9;
      const isEveningPeak = hour >= 16 && hour <= 19;
      const isNight = hour >= 22 || hour <= 5;
      
      const baseUtilization = isNight ? 0.1 : isMorningPeak || isEveningPeak ? 0.85 : 0.5;
      
      return {
        hour,
        evQueueLength: Math.round(baseUtilization * totalVehicles * 0.1),
        h2QueueLength: Math.round(baseUtilization * totalVehicles * 0.05),
        evWaitTime: Math.round(baseUtilization * 25), // minutes
        h2WaitTime: Math.round(baseUtilization * 10), // minutes
        evUtilization: Math.round(baseUtilization * 100),
        h2Utilization: Math.round(baseUtilization * 80),
      };
    });
  }, [vehicles]);

  // Grid capacity analysis
  const gridAnalysis = useMemo((): GridAnalysis => {
    const totalDailyKwh = vehicles.reduce((sum, v) => sum + ((v.annual_km / 365) * 0.25), 0);
    const peakDemandKw = totalDailyKwh / 4; // 4-hour charging window
    
    return {
      totalPowerNeeded: Math.round(totalDailyKwh),
      peakDemandKw: Math.round(peakDemandKw),
      offPeakPotential: Math.round(totalDailyKwh * 0.6), // 60% can shift to off-peak
      renewableIntegration: Math.round(totalDailyKwh * 0.3), // 30% from renewables
      v2gPotential: Math.round(peakDemandKw * 0.2), // 20% V2G potential
      upgradeRequired: peakDemandKw > 200,
      estimatedUpgradeCost: peakDemandKw > 500 ? 150000 : peakDemandKw > 200 ? 75000 : 0,
    };
  }, [vehicles]);

  return {
    vehicles,
    geographicZones,
    recommendations,
    alerts,
    usageSimulation,
    gridAnalysis,
    isLoading,
    error,
    hasData: vehicles.length > 0,
  };
}
