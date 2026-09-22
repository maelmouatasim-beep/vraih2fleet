import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TelematicsVehiclePosition {
  id: string;
  external_id: string;
  make_model: string;
  vehicle_type: string;
  annual_km: number;
  annual_km_real: number | null;
  fuel_consumption: number;
  route_type: string;
  latitude: number | null;
  longitude: number | null;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // Based on daily km usage
  vehicleId: string;
}

export interface UsagePattern {
  hour: number;
  usage: number; // 0-100 percentage
}

export interface GeographicCluster {
  id: string;
  name: string;
  centroid: { lat: number; lng: number };
  vehicleCount: number;
  totalDailyKm: number;
  priority: 'high' | 'medium' | 'low';
  recommendedStationType: 'ev_charger' | 'h2_station' | 'both';
}

export interface RecommendedLocation {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  stationType: 'ev_charger' | 'h2_station';
  priority: number; // 1-10
  estimatedDemand: number;
  vehiclesServed: number;
  reason: string;
}

export interface InfrastructureTelematicsData {
  vehicles: TelematicsVehiclePosition[];
  totalRealKm: number;
  totalEstimatedKm: number;
  hasRealData: boolean;
  heatmapPoints: HeatmapPoint[];
  peakUsageHours: UsagePattern[];
  geographicClusters: GeographicCluster[];
  recommendedLocations: RecommendedLocation[];
  isLoading: boolean;
  error: Error | null;
}

// Generate simulated GPS positions for Canadian fleet
const generateCanadianPosition = (vehicleType: string, index: number) => {
  // Canadian cities coordinates with variance
  const canadianCities = [
    { name: 'Toronto', lat: 43.65, lng: -79.38, weight: 30 },
    { name: 'Montreal', lat: 45.50, lng: -73.57, weight: 25 },
    { name: 'Vancouver', lat: 49.28, lng: -123.12, weight: 20 },
    { name: 'Calgary', lat: 51.05, lng: -114.07, weight: 10 },
    { name: 'Ottawa', lat: 45.42, lng: -75.69, weight: 8 },
    { name: 'Edmonton', lat: 53.54, lng: -113.49, weight: 7 },
  ];

  // Weighted random selection
  const totalWeight = canadianCities.reduce((acc, c) => acc + c.weight, 0);
  let random = (index * 7919) % totalWeight; // Deterministic "random" based on index
  let selectedCity = canadianCities[0];
  
  for (const city of canadianCities) {
    random -= city.weight;
    if (random <= 0) {
      selectedCity = city;
      break;
    }
  }

  // Add variance (±0.5 degrees)
  const latVariance = ((index * 31) % 100) / 100 - 0.5;
  const lngVariance = ((index * 47) % 100) / 100 - 0.5;

  return {
    latitude: selectedCity.lat + latVariance,
    longitude: selectedCity.lng + lngVariance,
  };
};

// Calculate peak usage hours based on vehicle patterns
const calculatePeakUsageHours = (vehicles: TelematicsVehiclePosition[]): UsagePattern[] => {
  // Simulated usage pattern based on typical fleet operations
  const basePattern = [
    { hour: 0, usage: 5 },
    { hour: 1, usage: 3 },
    { hour: 2, usage: 2 },
    { hour: 3, usage: 2 },
    { hour: 4, usage: 5 },
    { hour: 5, usage: 15 },
    { hour: 6, usage: 35 },
    { hour: 7, usage: 65 },
    { hour: 8, usage: 85 },
    { hour: 9, usage: 90 },
    { hour: 10, usage: 88 },
    { hour: 11, usage: 82 },
    { hour: 12, usage: 70 },
    { hour: 13, usage: 75 },
    { hour: 14, usage: 80 },
    { hour: 15, usage: 78 },
    { hour: 16, usage: 72 },
    { hour: 17, usage: 55 },
    { hour: 18, usage: 35 },
    { hour: 19, usage: 20 },
    { hour: 20, usage: 12 },
    { hour: 21, usage: 8 },
    { hour: 22, usage: 6 },
    { hour: 23, usage: 5 },
  ];

  // Adjust based on vehicle count
  const factor = vehicles.length > 0 ? Math.min(vehicles.length / 50, 1.5) : 1;
  
  return basePattern.map(p => ({
    hour: p.hour,
    usage: Math.min(100, p.usage * factor),
  }));
};

// Cluster vehicles by geographic proximity
const clusterVehicles = (vehicles: TelematicsVehiclePosition[]): GeographicCluster[] => {
  const vehiclesWithPos = vehicles.filter(v => v.latitude && v.longitude);
  if (vehiclesWithPos.length === 0) return [];

  // Simple clustering by rounding coordinates
  const clusters = new Map<string, TelematicsVehiclePosition[]>();
  
  vehiclesWithPos.forEach(v => {
    const key = `${Math.round(v.latitude! * 10) / 10},${Math.round(v.longitude! * 10) / 10}`;
    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(v);
  });

  const result: GeographicCluster[] = [];
  let idx = 0;
  
  clusters.forEach((clusterVehicles, key) => {
    const [lat, lng] = key.split(',').map(Number);
    const totalDailyKm = clusterVehicles.reduce((acc, v) => 
      acc + ((v.annual_km_real || v.annual_km) / 365), 0
    );
    const vehicleCount = clusterVehicles.length;
    
    // Determine priority based on vehicle count and usage
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (vehicleCount >= 10 || totalDailyKm > 500) priority = 'high';
    else if (vehicleCount >= 5 || totalDailyKm > 200) priority = 'medium';

    // Recommend station type based on vehicle types
    const heavyVehicles = clusterVehicles.filter(v => 
      v.vehicle_type.toLowerCase().includes('heavy')
    ).length;
    const lightVehicles = clusterVehicles.length - heavyVehicles;
    
    let recommendedStationType: 'ev_charger' | 'h2_station' | 'both' = 'ev_charger';
    if (heavyVehicles > lightVehicles) recommendedStationType = 'h2_station';
    else if (heavyVehicles > 0 && lightVehicles > 0) recommendedStationType = 'both';

    result.push({
      id: `cluster-${idx++}`,
      name: `Zone ${idx}`,
      centroid: { lat, lng },
      vehicleCount,
      totalDailyKm: Math.round(totalDailyKm),
      priority,
      recommendedStationType,
    });
  });

  return result.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
};

// Generate recommended locations based on clusters
const generateRecommendedLocations = (
  clusters: GeographicCluster[]
): RecommendedLocation[] => {
  return clusters
    .filter(c => c.priority !== 'low')
    .slice(0, 5)
    .map((cluster, idx) => ({
      id: `rec-${idx}`,
      name: `${cluster.name} - ${cluster.recommendedStationType === 'ev_charger' ? 'EV Station' : 'H₂ Station'}`,
      coordinates: cluster.centroid,
      stationType: cluster.recommendedStationType === 'both' ? 'ev_charger' : cluster.recommendedStationType,
      priority: 10 - idx * 2,
      estimatedDemand: cluster.totalDailyKm,
      vehiclesServed: cluster.vehicleCount,
      reason: cluster.priority === 'high' 
        ? 'High vehicle density zone' 
        : 'Medium traffic area',
    }));
};

export const useInfrastructureTelematicsData = (): InfrastructureTelematicsData => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['infrastructure-telematics-data', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { vehicles: [], connections: [] };
      }

      // Fetch telematics vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('telematics_vehicles')
        .select('*')
        .eq('user_id', user.id);

      if (vehiclesError) throw vehiclesError;

      return { vehicles: vehicles || [] };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Process vehicles with positions
  const vehiclesWithPositions: TelematicsVehiclePosition[] = (data?.vehicles || []).map((v, idx) => {
    const position = generateCanadianPosition(v.vehicle_type, idx);
    return {
      id: v.id,
      external_id: v.external_id,
      make_model: v.make_model,
      vehicle_type: v.vehicle_type,
      annual_km: v.annual_km,
      annual_km_real: null, // Will be populated from real odometer data when available
      fuel_consumption: v.fuel_consumption,
      route_type: v.route_type,
      latitude: position.latitude,
      longitude: position.longitude,
    };
  });

  // Calculate totals
  const totalRealKm = vehiclesWithPositions.reduce((acc, v) => 
    acc + (v.annual_km_real || 0), 0
  );
  const totalEstimatedKm = vehiclesWithPositions.reduce((acc, v) => 
    acc + v.annual_km, 0
  );
  const hasRealData = vehiclesWithPositions.some(v => v.annual_km_real !== null);

  // Generate heatmap points
  const heatmapPoints: HeatmapPoint[] = vehiclesWithPositions
    .filter(v => v.latitude && v.longitude)
    .map(v => ({
      latitude: v.latitude!,
      longitude: v.longitude!,
      weight: (v.annual_km_real || v.annual_km) / 365, // Daily km as weight
      vehicleId: v.id,
    }));

  // Calculate peak usage hours
  const peakUsageHours = calculatePeakUsageHours(vehiclesWithPositions);

  // Cluster vehicles geographically
  const geographicClusters = clusterVehicles(vehiclesWithPositions);

  // Generate recommended locations
  const recommendedLocations = generateRecommendedLocations(geographicClusters);

  return {
    vehicles: vehiclesWithPositions,
    totalRealKm,
    totalEstimatedKm,
    hasRealData,
    heatmapPoints,
    peakUsageHours,
    geographicClusters,
    recommendedLocations,
    isLoading,
    error: error as Error | null,
  };
};
